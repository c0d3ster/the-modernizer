import * as cheerio from 'cheerio'

import { deduplicateUrls, isNavigableUrl, normalizeUrl } from './url-utils.js'

export const extractLinks = (html: string, baseUrl: string, rootUrl: string): string[] => {
  const $ = cheerio.load(html)
  const links: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#')) return

    try {
      const absolute = new URL(href, baseUrl).toString()
      if (isNavigableUrl(absolute, rootUrl)) {
        links.push(normalizeUrl(absolute))
      }
    } catch {
      // malformed href, skip
    }
  })

  return deduplicateUrls(links)
}

export const extractImages = (html: string, baseUrl: string): string[] => {
  const $ = cheerio.load(html)
  const images: string[] = []

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src')
    if (!src || src.startsWith('data:')) return
    try {
      images.push(new URL(src, baseUrl).toString())
    } catch {
      // skip
    }
  })

  return [...new Set(images)]
}

export const extractTitle = (html: string): string => {
  const $ = cheerio.load(html)
  return $('title').first().text().trim() || ''
}
