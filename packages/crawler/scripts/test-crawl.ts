// Quick local test script — not part of the test suite
// Usage: pnpm --filter @modernizer/crawler crawl [url] [--save <path>]
// Example: pnpm --filter @modernizer/crawler crawl https://edgehillrecovery.org --save fixtures/edgehill.json

import * as cheerio from 'cheerio'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { crawl } from '../src/index.js'

const args = process.argv.slice(2)
const saveFlag = args.indexOf('--save')
const savePath = saveFlag !== -1 ? args[saveFlag + 1] : undefined
const url = (saveFlag !== -1 ? args.find((a, i) => !a.startsWith('--') && i !== saveFlag + 1) : args[0]) ?? 'https://edgehillrecovery.org'

console.log(`Crawling: ${url}\n`)

const results = await crawl(url, { maxPages: 20 })

for (const r of results) {
  const kb = Math.round(r.rawHtml.length / 1024)

  // extract visible text snippet for a quick sanity check
  const $ = cheerio.load(r.rawHtml)
  $('script, style, nav, header, footer').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 200)

  const flag = kb < 10 ? ' ⚠️  SMALL' : ''
  console.log(`[${r.fetchMethod}] ${r.statusCode} ${r.finalUrl}${flag}`)
  console.log(`  title:   ${r.title}`)
  console.log(`  html:    ${kb}kb | links: ${r.internalLinks.length} | images: ${r.images.length}`)
  console.log(`  preview: ${text || '(empty)'}`)
  console.log()
}

console.log(`Done. ${results.length} pages crawled.`)

if (savePath) {
  await mkdir(dirname(savePath), { recursive: true })
  await writeFile(savePath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\nFixture saved to: ${savePath}`)
}
