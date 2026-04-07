// Integration test script — not part of the test suite
// Reads saved crawl fixtures and runs the full extraction pipeline.
//
// Usage:
//   # Run extraction from saved fixture
//   pnpm --filter @modernizer/extractor extract fixtures/edgehill.json
//
//   # Save the resulting SiteSchema to disk
//   pnpm --filter @modernizer/extractor extract fixtures/edgehill.json --out fixtures/edgehill-schema.json
//
// To produce fixtures, run:
//   pnpm --filter @modernizer/crawler crawl https://edgehillrecovery.org --save ../extractor/fixtures/edgehill.json

import { config } from 'dotenv'
import { readFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CrawlResult } from '@modernizer/schema'
import { extract } from '../src/index.js'
import { getUsageStats } from '../src/llm-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outPath = outFlag !== -1 ? args[outFlag + 1] : undefined
const fixturePath = args.find((a, i) => !a.startsWith('--') && i !== outFlag + 1)

if (!fixturePath) {
  console.error('Usage: pnpm --filter @modernizer/extractor extract <fixture.json> [--out <schema.json>]')
  process.exit(1)
}

console.log(`Loading fixture: ${fixturePath}`)
const raw = await readFile(fixturePath, 'utf-8')
const crawlResults: CrawlResult[] = JSON.parse(raw)
console.log(`  ${crawlResults.length} pages loaded\n`)

console.log('Running extraction pipeline...')
console.log('  [1/3] Stripping chrome...')
console.log('  [2/3] Extracting site-level data (1 LLM call)...')
console.log('  [3/3] Classifying blocks per page...\n')

const schema = await extract(crawlResults, outPath ? { outputPath: outPath } : {})

// --- summary ---
console.log('=== Extraction complete ===\n')
console.log(`Site:    ${schema.siteName}`)
if (schema.tagline) console.log(`Tagline: ${schema.tagline}`)
console.log(`Root:    ${schema.rootUrl}`)
console.log(`Colors:  primary=${schema.brandColors.primary}${schema.brandColors.secondary ? ` secondary=${schema.brandColors.secondary}` : ''}`)
console.log(`Nav:     ${schema.nav.length} top-level items`)
console.log(`Pages:   ${schema.pages.length}\n`)

// block type histogram
const histogram: Record<string, number> = {}
for (const page of schema.pages) {
  for (const block of page.blocks) {
    histogram[block.type] = (histogram[block.type] ?? 0) + 1
  }
}

console.log('Block type breakdown:')
for (const [type, count] of Object.entries(histogram).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(20)} ${count}`)
}

console.log('\nPages:')
for (const page of schema.pages) {
  console.log(`  [${page.archetype.padEnd(12)}] ${page.title} (${page.blocks.length} blocks)`)
  console.log(`    ${page.url}`)
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  console.log(`\nSchema saved to: ${outPath}`)
}

const stats = getUsageStats()
console.log('\n=== LLM usage ===')
console.log(`  Calls:        ${stats.calls}`)
console.log(`  Input tokens: ${stats.inputTokens.toLocaleString()}`)
console.log(`  Output tokens:${stats.outputTokens.toLocaleString()}`)
console.log(`  Est. cost:    $${stats.estimatedCostUsd.toFixed(4)}`)
