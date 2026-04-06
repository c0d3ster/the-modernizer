import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'

const CHROME_THRESHOLD = 0.6

const CHROME_SELECTORS = [
  'nav',
  'header',
  'footer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.cookie-banner',
  '.cookie-notice',
  '.popup',
  '.modal',
  '.widget-area',
  '.sidebar',
  '#sidebar',
  '.site-header',
  '.site-footer',
  '.nav-menu',
  '.wp-block-navigation',
]

const hashHtml = (html: string): string =>
  createHash('md5').update(html).digest('hex')

export interface StrippedPages {
  // page rawHtml with chrome removed
  contentHtml: Record<string, string>
  // preserved chrome HTML (nav + footer from the first page that had it)
  chromeHtml: string
}

export const stripChrome = (pages: Array<{ url: string; rawHtml: string }>): StrippedPages => {
  if (pages.length === 0) return { contentHtml: {}, chromeHtml: '' }

  // Step 1: count how often each top-level element hash appears across pages
  const hashCounts = new Map<string, number>()

  for (const page of pages) {
    const $ = cheerio.load(page.rawHtml)
    $('body').children().each((_, el) => {
      const h = hashHtml($.html(el) ?? '')
      hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1)
    })
  }

  const chromeHashes = new Set<string>()
  for (const [hash, count] of hashCounts) {
    if (count / pages.length >= CHROME_THRESHOLD) {
      chromeHashes.add(hash)
    }
  }

  // Step 2: strip chrome from each page, collect first-occurrence chrome HTML
  const contentHtml: Record<string, string> = {}
  let chromeHtml = ''

  for (const page of pages) {
    const $ = cheerio.load(page.rawHtml)
    const chromeFragments: string[] = []

    // remove by hash (shared elements)
    $('body').children().each((_, el) => {
      const elHtml = $.html(el) ?? ''
      const h = hashHtml(elHtml)
      if (chromeHashes.has(h)) {
        if (!chromeHtml) { chromeFragments.push(elHtml) }
        $(el).remove()
      }
    })

    // remove by semantic selectors
    for (const selector of CHROME_SELECTORS) {
      if (!chromeHtml) {
        $(selector).each((_, el) => { chromeFragments.push($.html(el) ?? '') })
      }
      $(selector).remove()
    }

    if (!chromeHtml && chromeFragments.length > 0) {
      chromeHtml = chromeFragments.join('\n')
    }

    contentHtml[page.url] = $('body').html() ?? ''
  }

  return { contentHtml, chromeHtml }
}
