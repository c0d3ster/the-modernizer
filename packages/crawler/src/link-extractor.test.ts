import { describe, expect, it } from 'vitest'

import { extractImages, extractLinks, extractTitle } from './link-extractor.js'

const ROOT = 'https://example.com'
const BASE = 'https://example.com/page'

describe('extractLinks', () => {
  it('extracts internal links', () => {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </body></html>
    `
    const links = extractLinks(html, BASE, ROOT)
    expect(links).toContain('https://example.com/about')
    expect(links).toContain('https://example.com/contact')
  })

  it('filters out external links', () => {
    const html = `<a href="https://google.com">Google</a>`
    expect(extractLinks(html, BASE, ROOT)).toHaveLength(0)
  })

  it('filters out asset links', () => {
    const html = `<a href="/file.pdf">Download</a>`
    expect(extractLinks(html, BASE, ROOT)).toHaveLength(0)
  })

  it('filters out hash-only links', () => {
    const html = `<a href="#top">Back to top</a>`
    expect(extractLinks(html, BASE, ROOT)).toHaveLength(0)
  })

  it('filters out javascript: links', () => {
    const html = `<a href="javascript:void(0)">Click</a>`
    expect(extractLinks(html, BASE, ROOT)).toHaveLength(0)
  })

  it('resolves relative links against baseUrl', () => {
    const html = `<a href="../services">Services</a>`
    const links = extractLinks(html, 'https://example.com/about/team', ROOT)
    expect(links).toContain('https://example.com/services')
  })

  it('deduplicates links', () => {
    const html = `
      <a href="/about">About</a>
      <a href="/about/">About again</a>
      <a href="https://example.com/about">About absolute</a>
    `
    const links = extractLinks(html, BASE, ROOT)
    const aboutLinks = links.filter((l) => l.includes('/about'))
    expect(aboutLinks).toHaveLength(1)
  })

  it('returns empty array for page with no links', () => {
    expect(extractLinks('<p>No links here</p>', BASE, ROOT)).toHaveLength(0)
  })
})

describe('extractImages', () => {
  it('extracts image src attributes', () => {
    const html = `
      <img src="/img/photo.jpg" alt="Photo">
      <img src="https://example.com/logo.png">
    `
    const images = extractImages(html, BASE)
    expect(images).toContain('https://example.com/img/photo.jpg')
    expect(images).toContain('https://example.com/logo.png')
  })

  it('skips data: URIs', () => {
    const html = `<img src="data:image/png;base64,abc123">`
    expect(extractImages(html, BASE)).toHaveLength(0)
  })

  it('deduplicates images', () => {
    const html = `
      <img src="/img/photo.jpg">
      <img src="/img/photo.jpg">
    `
    expect(extractImages(html, BASE)).toHaveLength(1)
  })
})

describe('extractTitle', () => {
  it('extracts title from <title> tag', () => {
    const html = `<html><head><title>My Page</title></head></html>`
    expect(extractTitle(html)).toBe('My Page')
  })

  it('returns empty string when no title', () => {
    expect(extractTitle('<html><body>No title</body></html>')).toBe('')
  })

  it('trims whitespace', () => {
    const html = `<title>  Spaced Title  </title>`
    expect(extractTitle(html)).toBe('Spaced Title')
  })
})
