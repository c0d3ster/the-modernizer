import * as cheerio from 'cheerio'

import { deduplicateUrls, isNavigableUrl, normalizeUrl } from './url-utils.js'

const getBase = ($: ReturnType<typeof cheerio.load>, pageUrl: string): string => {
  const baseHref = $('base[href]').first().attr('href')
  if (!baseHref) return pageUrl
  try {
    return new URL(baseHref, pageUrl).toString()
  } catch {
    return pageUrl
  }
}

export const extractLinks = (html: string, baseUrl: string, rootUrl: string): string[] => {
  const $ = cheerio.load(html)
  const base = getBase($, baseUrl)
  const links: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#')) return

    try {
      const absolute = new URL(href, base).toString()
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
  const base = getBase($, baseUrl)
  const images: string[] = []

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src')
    if (!src || src.startsWith('data:')) return
    try {
      images.push(new URL(src, base).toString())
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
