// Quick local test script — not part of the test suite
// Usage: pnpm --filter @modernizer/crawler crawl <url>
// Example: pnpm --filter @modernizer/crawler crawl https://edgehillrecovery.org

import * as cheerio from 'cheerio'
import { crawl } from '../src/index.js'

const url = process.argv[2] ?? 'https://edgehillrecovery.org'

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
