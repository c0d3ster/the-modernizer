import * as cheerio from 'cheerio'

const VISIBLE_TEXT_THRESHOLD = 200

const getVisibleTextLength = (html: string): number => {
  const $ = cheerio.load(html)
  $('script, style, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim().length
}

export interface StaticFetchResult {
  html: string
  statusCode: number
  finalUrl: string
}

export const staticFetch = async (url: string): Promise<StaticFetchResult | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; the-modernizer/1.0)',
        'accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return null

    const html = await response.text()

    if (getVisibleTextLength(html) < VISIBLE_TEXT_THRESHOLD) return null

    return { html, statusCode: response.status, finalUrl: response.url }
  } catch {
    return null
  }
}
