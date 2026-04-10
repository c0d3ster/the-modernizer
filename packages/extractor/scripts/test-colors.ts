import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import * as cheerio from 'cheerio'
import { stripChrome } from '../src/chrome-stripper.js'
import { splitBlocks } from '../src/block-splitter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pages = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/edgehill.json'), 'utf8'))

const { contentHtml } = stripChrome(pages.map((p: { url: string; rawHtml: string }) => ({ url: p.url, rawHtml: p.rawHtml })))
const homeUrl = pages[0].url
const homeHtml = contentHtml[homeUrl] ?? ''

const blocks = splitBlocks(homeHtml)
console.log(`Blocks found: ${blocks.length}\n`)
for (const [i, b] of blocks.entries()) {
  const $ = cheerio.load(b.html)
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 120)
  console.log(`Block ${i + 1}: heading="${b.headingText ?? '(none)'}"`)
  console.log(`  Text: ${text}`)
  console.log()
}
