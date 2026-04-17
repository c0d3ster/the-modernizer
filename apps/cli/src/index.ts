#!/usr/bin/env node
import { config } from 'dotenv'
import { resolve as resolvePath } from 'node:path'
config({ path: resolvePath(process.cwd(), '.env') })
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { Command } from 'commander'
import { crawl } from '@modernizer/crawler'
import { extract, getUsageStats } from '@modernizer/extractor'
import { generateSite } from '@modernizer/generator'
import { siteSchemaSchema } from '@modernizer/schema'

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const program = new Command()

program
  .name('the-modernizer')
  .description('Crawl an outdated website and regenerate it as a modern Next.js app')
  .version('0.0.0')
  .argument('[url]', 'URL of the site to modernize')
  .option('-o, --output <dir>', 'output directory (defaults to .generated/<site-slug>)')
  .option('--max-pages <n>', 'maximum pages to crawl', '100')
  .option('--max-depth <n>', 'maximum crawl depth', '3')
  .option('--schema-only', 'stop after extraction and write SiteSchema JSON', false)
  .option('--from-schema <file>', 'skip crawl/extract and generate from a saved schema JSON')
  .option('--primary-color <hex>', 'override auto-detected brand color (e.g. #2563eb)')
  .option('--verbose', 'detailed logging', false)
  .option(
    '--headless',
    'use headless Chromium for Playwright fallback (CI, Docker); default is headful. Env MODERNIZER_HEADLESS=true also enables headless',
  )

program.action(async (url: string | undefined, opts: {
  output?: string
  maxPages: string
  maxDepth: string
  schemaOnly: boolean
  fromSchema?: string
  primaryColor?: string
  verbose: boolean
  headless?: boolean
}) => {
  const verbose = opts.verbose
  const log = (msg: string): void => { process.stdout.write(msg + '\n') }
  const debug = (msg: string): void => { if (verbose) process.stdout.write('  ' + msg + '\n') }

  try {
    // ── Stage 0: load from saved schema (skip crawl + extract) ────────────
    if (opts.fromSchema) {
      const schemaPath = resolve(opts.fromSchema)
      log(`Loading schema from ${schemaPath}...`)
      const raw = await readFile(schemaPath, 'utf-8')
      let schema = siteSchemaSchema.parse(JSON.parse(raw))

      if (opts.primaryColor) {
        schema = { ...schema, brandColors: { ...schema.brandColors, primary: opts.primaryColor } }
      }

      const outDir = resolve(opts.output ?? join('.generated', slugify(schema.siteName)))
      log(`Generating: ${schema.siteName} (${schema.pages.length} pages)`)
      await mkdir(outDir, { recursive: true })
      await generateSite(schema, outDir)
      log(`\nDone! Output: ${outDir}`)
      log(`  cd ${outDir} && npm install && npm run dev`)
      return
    }

    // ── Stage 1: crawl ─────────────────────────────────────────────────────
    if (!url) {
      process.stderr.write('\nError: <url> is required unless --from-schema is used\n')
      process.exit(1)
    }
    log(`Crawling ${url}...`)
    const maxPages = parseInt(opts.maxPages, 10)
    const pages = await crawl(url, {
      maxPages,
      maxDepth: parseInt(opts.maxDepth, 10),
      ...(opts.headless ? { playwrightHeadless: true } : {}),
      onPageCrawled: (result, total) => {
        process.stdout.write(`\r  Crawled ${total} / ${maxPages}: ${result.title || result.url}`.padEnd(80))
      },
    })
    process.stdout.write('\n')
    log(`  Done — ${pages.length} pages`)
    debug(`  Seed URL: ${url}`)

    // ── Stage 2: extract ───────────────────────────────────────────────────
    log(`Extracting content...`)
    let schema = await extract(pages)
    const stats = getUsageStats()
    log(`  Extracted ${schema.pages.length} pages — ${stats.calls} LLM calls, ${stats.inputTokens + stats.outputTokens} tokens, ~$${stats.estimatedCostUsd.toFixed(4)}`)

    if (opts.primaryColor) {
      schema = { ...schema, brandColors: { ...schema.brandColors, primary: opts.primaryColor } }
    }

    const outDir = resolve(opts.output ?? join('.generated', slugify(schema.siteName)))

    // ── Schema-only mode ───────────────────────────────────────────────────
    if (opts.schemaOnly) {
      await mkdir(outDir, { recursive: true })
      const schemaPath = join(outDir, 'schema.json')
      await writeFile(schemaPath, JSON.stringify(schema, null, 2))
      log(`\nSchema written to ${schemaPath}`)
      return
    }

    // ── Stage 3: generate ──────────────────────────────────────────────────
    log(`Generating site...`)
    await mkdir(outDir, { recursive: true })
    await generateSite(schema, outDir)

    log(`\nDone! Output: ${outDir}`)
    log(`  cd ${outDir} && npm install && npm run dev`)
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
    if (verbose && err instanceof Error && err.stack) {
      process.stderr.write(err.stack + '\n')
    }
    process.exit(1)
  }
})

program.parse()
