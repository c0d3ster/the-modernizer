import { playwrightFetch, closeBrowser } from './playwright-fetcher.js'
import { staticFetch } from './static-fetcher.js'
import { extractImages, extractLinks, extractTitle } from './link-extractor.js'
import { fetchDisallowedPaths, isAllowed } from './robots.js'
import { normalizeUrl } from './url-utils.js'
import type { CrawlOptions } from './types.js'
import type { CrawlResult } from '@modernizer/schema'

const DEFAULT_OPTIONS: Required<Omit<CrawlOptions, 'onPageCrawled'>> = {
  maxPages: 100,
  maxDepth: 3,
  concurrency: 3,
  delayMs: 200,
  respectRobotsTxt: true,
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const fetchPage = async (url: string): Promise<{ html: string; statusCode: number; finalUrl: string; fetchMethod: 'static' | 'playwright' } | null> => {
  const staticResult = await staticFetch(url)
  if (staticResult) return { ...staticResult, fetchMethod: 'static' }

  const playwrightResult = await playwrightFetch(url)
  if (playwrightResult) return { ...playwrightResult, fetchMethod: 'playwright' }

  return null
}

export const crawl = async (
  seedUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult[]> => {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    concurrency: Math.max(1, options.concurrency ?? DEFAULT_OPTIONS.concurrency),
  }
  const rootUrl = normalizeUrl(seedUrl)

  const disallowedPaths = opts.respectRobotsTxt
    ? await fetchDisallowedPaths(rootUrl)
    : []

  const visited = new Set<string>()
  const results: CrawlResult[] = []

  // queue entries: [url, depth]
  const queue: Array<[string, number]> = [[rootUrl, 0]]

  try {
    while (queue.length > 0 && results.length < opts.maxPages) {
      const batch = queue.splice(0, opts.concurrency)

      await Promise.all(
        batch.map(async ([url, depth]) => {
          if (visited.has(url)) return
          if (!isAllowed(url, disallowedPaths)) return
          visited.add(url)

          const result = await fetchPage(url)
          if (!result) return

          const { html, statusCode, finalUrl, fetchMethod } = result

          // mark the canonical (post-redirect) URL visited too
          const normalizedFinal = normalizeUrl(finalUrl)
          visited.add(normalizedFinal)

          const internalLinks = depth < opts.maxDepth
            ? extractLinks(html, finalUrl, rootUrl)
            : []

          if (results.length >= opts.maxPages) return

          const crawlResult: CrawlResult = {
            url,
            finalUrl,
            title: extractTitle(html),
            rawHtml: html,
            statusCode,
            fetchMethod,
            images: extractImages(html, finalUrl),
            assets: [],
            internalLinks,
            crawledAt: new Date().toISOString(),
          }
          results.push(crawlResult)
          opts.onPageCrawled?.(crawlResult, results.length)

          for (const link of internalLinks) {
            if (!visited.has(link)) {
              queue.push([link, depth + 1])
            }
          }
        })
      )

      if (queue.length > 0 && opts.delayMs > 0) {
        await delay(opts.delayMs)
      }
    }
  } finally {
    await closeBrowser()
  }

  return results
}
