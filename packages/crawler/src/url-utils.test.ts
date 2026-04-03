import { describe, expect, it } from 'vitest'

import {
  deduplicateUrls,
  isAssetUrl,
  isNavigableUrl,
  isSameDomain,
  normalizeUrl,
} from './url-utils.js'

describe('normalizeUrl', () => {
  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/page')).toBe('https://example.com/page')
  })

  it('strips trailing slash from path', () => {
    expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about')
  })

  it('preserves root slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('strips hash fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })

  it('preserves query string', () => {
    expect(normalizeUrl('https://example.com/search?q=test')).toBe(
      'https://example.com/search?q=test'
    )
  })

  it('preserves http protocol', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('http://example.com/page')
  })

  it('returns original on malformed url', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
  })
})

describe('isSameDomain', () => {
  it('returns true for same domain', () => {
    expect(isSameDomain('https://example.com/about', 'https://example.com')).toBe(true)
  })

  it('returns false for different domain', () => {
    expect(isSameDomain('https://other.com/page', 'https://example.com')).toBe(false)
  })

  it('returns false for subdomain', () => {
    expect(isSameDomain('https://sub.example.com/page', 'https://example.com')).toBe(false)
  })
})

describe('isAssetUrl', () => {
  it('detects image extensions', () => {
    expect(isAssetUrl('https://example.com/img/photo.jpg')).toBe(true)
    expect(isAssetUrl('https://example.com/img/photo.png')).toBe(true)
    expect(isAssetUrl('https://example.com/img/photo.svg')).toBe(true)
  })

  it('detects document extensions', () => {
    expect(isAssetUrl('https://example.com/file.pdf')).toBe(true)
    expect(isAssetUrl('https://example.com/file.docx')).toBe(true)
  })

  it('detects font extensions', () => {
    expect(isAssetUrl('https://example.com/font.woff2')).toBe(true)
  })

  it('returns false for html pages', () => {
    expect(isAssetUrl('https://example.com/about')).toBe(false)
    expect(isAssetUrl('https://example.com/about.html')).toBe(false)
  })
})

describe('isNavigableUrl', () => {
  const root = 'https://example.com'

  it('accepts same-domain html pages', () => {
    expect(isNavigableUrl('https://example.com/about', root)).toBe(true)
  })

  it('rejects javascript: links', () => {
    expect(isNavigableUrl('javascript:void(0)', root)).toBe(false)
  })

  it('rejects mailto: links', () => {
    expect(isNavigableUrl('mailto:info@example.com', root)).toBe(false)
  })

  it('rejects hash-only links', () => {
    expect(isNavigableUrl('#section', root)).toBe(false)
  })

  it('rejects external domains', () => {
    expect(isNavigableUrl('https://google.com', root)).toBe(false)
  })

  it('rejects asset urls', () => {
    expect(isNavigableUrl('https://example.com/brochure.pdf', root)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isNavigableUrl('', root)).toBe(false)
  })
})

describe('deduplicateUrls', () => {
  it('removes exact duplicates', () => {
    const urls = [
      'https://example.com/about',
      'https://example.com/about',
      'https://example.com/contact',
    ]
    expect(deduplicateUrls(urls)).toHaveLength(2)
  })

  it('deduplicates after normalization', () => {
    const urls = [
      'https://example.com/about',
      'https://example.com/about/',
      'https://EXAMPLE.COM/about',
    ]
    expect(deduplicateUrls(urls)).toHaveLength(1)
  })
})
