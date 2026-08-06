import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { SiteSchema } from '@modernizer/schema'
import {
  generatePackageJson,
  generateNextConfig,
  generateTsConfig,
  generatePostcss,
  generateGlobalsCss,
  collectImageHostnames,
} from '@modernizer/generator-config'
import { copyDeterministicComponents } from './component-copier.js'
import { callClaudeForFiles, costForUsage, getUsageTotals, resetUsageTotals, type GeneratedFile } from './llm-client.js'
import { mapWithConcurrency } from './concurrency.js'
import { buildShellPrompt } from './prompts/shell-prompt.js'
import { buildPagePrompt } from './prompts/page-prompt.js'
import { fillMissingHeroImages } from './hero-image.js'
import { extractDesignSystemSpec } from './design-system.js'

const PAGE_CONCURRENCY = 4

export const generateWithClaude = async (siteSchema: SiteSchema, outDir: string, verbose = false): Promise<void> => {
  resetUsageTotals()
  const startTime = Date.now()

  // Fill in hero backgrounds before any prompt is built so both the shell/page Claude calls and
  // collectImageHostnames() below see the final image URLs.
  const schema = await fillMissingHeroImages(siteSchema, outDir, verbose)

  if (verbose) {
    process.stdout.write(`  ${schema.pages.length} pages, concurrency ${PAGE_CONCURRENCY}\n`)
  }

  // The shell call runs first (not alongside the page calls) for two reasons: it decides the
  // design system (spacing/card/heading/button conventions — see design-system.ts) that every
  // page call below needs, and it warms its own cache_control entry before anything else fires.
  const shellResult = await callClaudeForFiles(buildShellPrompt(schema), 'shell', verbose)
  const { spec: designSystemSpec, files: shellFiles, validationError } = extractDesignSystemSpec(shellResult)

  if (verbose) {
    if (designSystemSpec) {
      process.stdout.write(`  Design system captured (${designSystemSpec.length.toLocaleString()} chars) — threading into all page calls\n`)
    } else if (validationError) {
      process.stdout.write(`  Design system spec failed validation (${validationError}) — pages will not share explicit visual conventions\n`)
    } else {
      process.stdout.write(`  No design system spec in shell output — pages will not share explicit visual conventions\n`)
    }
  }

  // Every page call shares an identical cache_control-marked site-context block that now
  // includes the design system spec above — a different cached block than the shell used (it
  // doesn't have the spec yet when it runs), so the first page call here re-establishes the
  // cache entry and every page call after it reads from that instead of paying full price.
  const [firstPage, ...restPages] = schema.pages
  let pageFiles: GeneratedFile[] = []
  if (firstPage) {
    const firstPageFiles = await callClaudeForFiles(buildPagePrompt(schema, firstPage, designSystemSpec), firstPage.title, verbose)
    const restPageFiles = (
      await mapWithConcurrency(restPages, PAGE_CONCURRENCY, (page) =>
        callClaudeForFiles(buildPagePrompt(schema, page, designSystemSpec), page.title, verbose)
      )
    ).flat()
    pageFiles = [...firstPageFiles, ...restPageFiles]
  }

  const claudeFiles: GeneratedFile[] = [...shellFiles, ...pageFiles]

  const deterministicComponents = await copyDeterministicComponents()
  const deterministicFiles: GeneratedFile[] = [
    { path: 'package.json', content: generatePackageJson(schema) },
    { path: 'next.config.ts', content: generateNextConfig(collectImageHostnames(schema)) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'postcss.config.mjs', content: generatePostcss() },
    { path: 'src/app/globals.css', content: generateGlobalsCss(schema.brandColors) },
    ...deterministicComponents,
    // docs/ is where every human-facing artifact of the modernization effort lands (design
    // system today; the modernization report will join it once that exists) — not under src/
    // since none of it is app code.
    ...(designSystemSpec ? [{ path: 'docs/design-system.md', content: designSystemSpec }] : []),
  ]
  const deterministicPaths = new Set(deterministicFiles.map((f) => f.path))
  const allFiles = [...deterministicFiles, ...claudeFiles.filter((f) => !deterministicPaths.has(f.path))]

  await Promise.all(
    allFiles.map(async ({ path, content }) => {
      const fullPath = join(outDir, path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content)
    })
  )

  const elapsedSeconds = (Date.now() - startTime) / 1000
  const usage = getUsageTotals()
  const cost = costForUsage(usage)

  process.stdout.write(`  Wrote ${allFiles.length} files via ${usage.calls} Claude calls\n`)
  process.stdout.write(`  Time: ${elapsedSeconds.toFixed(1)}s\n`)
  process.stdout.write(
    `  Tokens: ${usage.inputTokens.toLocaleString()} in, ${usage.outputTokens.toLocaleString()} out` +
      (usage.cacheCreationTokens || usage.cacheReadTokens
        ? `, ${usage.cacheCreationTokens.toLocaleString()} cache write, ${usage.cacheReadTokens.toLocaleString()} cache read\n`
        : '\n')
  )
  process.stdout.write(`  Cost: $${cost.toFixed(4)}\n`)
}
