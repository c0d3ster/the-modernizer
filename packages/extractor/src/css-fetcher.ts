import * as cheerio from 'cheerio'

/**
 * Extracts all unique stylesheet URLs from crawled pages and fetches their content.
 * Deduplicates across pages so each CSS file is fetched at most once.
 */
export const fetchLinkedCss = async (
  pages: Array<{ rawHtml: string; url: string }>
): Promise<string[]> => {
  const cssUrls = new Set<string>()

  for (const { rawHtml, url } of pages) {
    const $ = cheerio.load(rawHtml)
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return
      try {
        cssUrls.add(new URL(href, url).href)
      } catch {
        // relative URL resolution failed — skip
      }
    })
  }

  const fetched = await Promise.allSettled(
    [...cssUrls].map(async (cssUrl) => {
      const response = await fetch(cssUrl, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; the-modernizer/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) return null
      const ct = response.headers.get('content-type') ?? ''
      if (!ct.includes('text/css') && !ct.includes('text/plain') && !ct.includes('octet-stream')) return null
      return response.text()
    })
  )

  return fetched
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
}
