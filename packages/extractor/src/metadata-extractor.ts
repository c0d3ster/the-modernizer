import * as cheerio from 'cheerio'

export interface PageMetadata {
  title: string
  metaDescription?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  canonicalUrl?: string
}

export const extractMetadata = (html: string, fallbackUrl: string): PageMetadata => {
  const $ = cheerio.load(html)

  const title =
    $('h1').first().text().trim() ||
    $('title').first().text().trim() ||
    fallbackUrl

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim()

  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim()
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim()
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim()
  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim()

  return {
    title,
    ...(metaDescription && { metaDescription }),
    ...(ogTitle && { ogTitle }),
    ...(ogDescription && { ogDescription }),
    ...(ogImage && { ogImage }),
    ...(canonicalUrl && { canonicalUrl }),
  }
}
