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

  // The shell call and every page call share an identical, cache_control-marked site-context
  // block (see prompts/shared.ts). Running the shell call first — instead of alongside the
  // page calls — writes that cache entry before any page call fires, so all `pages.length`
  // page calls read it from cache instead of each paying full input-token price for it.
  const shellFiles = await callClaudeForFiles(buildShellPrompt(schema), 'shell', verbose)
  const pageFiles = (
    await mapWithConcurrency(schema.pages, PAGE_CONCURRENCY, (page) =>
      callClaudeForFiles(buildPagePrompt(schema, page), page.title, verbose)
    )
  ).flat()

  const claudeFiles: GeneratedFile[] = [...shellFiles, ...pageFiles]

  const deterministicComponents = await copyDeterministicComponents()
  const deterministicFiles: GeneratedFile[] = [
    { path: 'package.json', content: generatePackageJson(schema) },
    { path: 'next.config.ts', content: generateNextConfig(collectImageHostnames(schema)) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'postcss.config.mjs', content: generatePostcss() },
    { path: 'src/app/globals.css', content: generateGlobalsCss(schema.brandColors) },
    ...deterministicComponents,
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
