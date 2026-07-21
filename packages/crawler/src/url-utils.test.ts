import { describe, expect, it } from 'vitest'

import {
  deduplicateUrls,
  isAssetUrl,
  isNavigableUrl,
  isSameDomain,
  normalizeUrl,
  unwrapWaybackUrl,
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

  it('unwraps wayback snapshot urls before comparing', () => {
    expect(
      isSameDomain(
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/about',
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
      )
    ).toBe(true)
  })

  it('treats different snapshot timestamps of the same site as same domain', () => {
    expect(
      isSameDomain(
        'https://web.archive.org/web/20240101000000/https://edgehillrecovery.org/about',
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
      )
    ).toBe(true)
  })

  it('rejects the wayback calendar snapshot picker', () => {
    expect(
      isSameDomain(
        'https://web.archive.org/web/20260411201239*/https://edgehillrecovery.org',
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
      )
    ).toBe(false)
  })

  it('rejects the wayback screenshot endpoint', () => {
    expect(
      isSameDomain(
        'https://web.archive.org/web/20260411201239/http://web.archive.org/screenshot/https://edgehillrecovery.org',
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
      )
    ).toBe(false)
  })

  it('rejects the bare archive.org homepage', () => {
    expect(
      isSameDomain(
        'https://web.archive.org/',
        'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
      )
    ).toBe(false)
  })
})

describe('unwrapWaybackUrl', () => {
  it('extracts the original url from a wayback snapshot url', () => {
    expect(
      unwrapWaybackUrl('https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/about')
    ).toBe('https://edgehillrecovery.org/about')
  })

  it('handles wayback modifier flags like im_ and id_', () => {
    expect(
      unwrapWaybackUrl('https://web.archive.org/web/20260411201239im_/https://edgehillrecovery.org/style.css')
    ).toBe('https://edgehillrecovery.org/style.css')
  })

  it('returns non-wayback urls unchanged', () => {
    expect(unwrapWaybackUrl('https://example.com/about')).toBe('https://example.com/about')
  })

  it('returns the calendar snapshot picker url unchanged (does not match the pattern)', () => {
    const url = 'https://web.archive.org/web/20260411201239*/https://edgehillrecovery.org'
    expect(unwrapWaybackUrl(url)).toBe(url)
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

  it('accepts other snapshot timestamps of the same site when crawling via wayback', () => {
    const waybackRoot = 'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
    expect(
      isNavigableUrl(
        'https://web.archive.org/web/20240101000000/https://edgehillrecovery.org/about',
        waybackRoot
      )
    ).toBe(true)
  })

  it('rejects wayback toolbar chrome when crawling via wayback', () => {
    const waybackRoot = 'https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/'
    expect(
      isNavigableUrl('https://web.archive.org/web/20260411201239*/https://edgehillrecovery.org', waybackRoot)
    ).toBe(false)
    expect(isNavigableUrl('https://web.archive.org/', waybackRoot)).toBe(false)
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
