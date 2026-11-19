import { describe, it, expect } from 'vitest'
import type { SiteImage } from '@modernizer/schema'

import { imageInventory, originalImageUrl, pageImages, sizeFromUrl } from './image-inventory.js'
import { heroCandidates, heroScore } from './hero-choice.js'

const home = 'https://example.com/'

describe('originalImageUrl', () => {
  it('drops the Wix resize transform', () => {
    expect(originalImageUrl('https://static.wixstatic.com/media/abc_123~mv2.jpg/v1/fill/w_147,h_98,blur_2/abc.jpg')).toBe(
      'https://static.wixstatic.com/media/abc_123~mv2.jpg'
    )
  })
  it('asks Squarespace for the large rendition', () => {
    expect(originalImageUrl('https://images.squarespace-cdn.com/content/a.jpg?format=300w')).toBe('https://images.squarespace-cdn.com/content/a.jpg?format=2500w')
  })
  it('leaves other URLs alone', () => {
    expect(originalImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
  })
})

describe('sizeFromUrl', () => {
  it('reads Wix and WordPress sizes', () => {
    expect(sizeFromUrl('https://static.wixstatic.com/media/x.jpg/v1/fill/w_600,h_400/x.jpg')).toEqual({ width: 600, height: 400 })
    expect(sizeFromUrl('https://example.com/wp-content/uploads/team-1200x800.jpg')).toEqual({ width: 1200, height: 800 })
    expect(sizeFromUrl('https://example.com/a.jpg')).toEqual({})
  })
})

describe('pageImages', () => {
  const html = `<html><body>
    <header><a href="/"><img src="/brand.png" alt="Acme"></a></header>
    <img src="/icons/facebook.svg">
    <img srcset="/team-600.jpg 600w, /team-1600.jpg 1600w" alt="Our team" width="1600" height="900">
    <div style="background-image: url('/food.jpg')"></div>
    <img src="data:image/gif;base64,R0lG">
  </body></html>`

  it('classifies the header image as the logo, svgs as icons, the rest as photos', () => {
    const images = pageImages({ url: home, rawHtml: html })
    expect(images.map((i) => [i.url, i.kind])).toEqual([
      ['https://example.com/brand.png', 'logo'],
      ['https://example.com/icons/facebook.svg', 'icon'],
      ['https://example.com/team-1600.jpg', 'photo'],
      ['https://example.com/food.jpg', 'photo'],
    ])
    expect(images[2]).toMatchObject({ alt: 'Our team', width: 1600, height: 900 })
  })

  it('keeps photos and the logo across pages, deduplicated', () => {
    const { images, logoUrl } = imageInventory([
      { url: home, rawHtml: html },
      { url: 'https://example.com/about', rawHtml: html },
    ])
    expect(logoUrl).toBe('https://example.com/brand.png')
    expect(images.filter((i) => i.kind === 'photo')).toHaveLength(2)
    expect(images.every((i) => i.pageUrl === home)).toBe(true)
  })

  it('prefers a logo the site declares in JSON-LD', () => {
    const declared = `<script type="application/ld+json">{"@type":"Dentist","logo":{"@type":"ImageObject","url":"/declared-logo.png"}}</script>${html}`
    expect(imageInventory([{ url: home, rawHtml: declared }]).logoUrl).toBe('https://example.com/declared-logo.png')
  })
})

const photo = (url: string, extra: Partial<SiteImage> = {}): SiteImage => ({ url, kind: 'photo', pageUrl: home, order: 0, ...extra })

describe('hero choice', () => {
  it('ranks a large landscape home photo over a sign, a banner strip and a small image', () => {
    const team = photo('https://example.com/team.jpg', { width: 1600, height: 900, order: 3 })
    const sign = photo('https://example.com/front-sign.jpg', { width: 1600, height: 900, order: 0 })
    const strip = photo('https://example.com/strip.jpg', { width: 2000, height: 300 })
    const small = photo('https://example.com/thumb.jpg', { width: 300, height: 200 })
    expect(heroScore(team, home)).toBeGreaterThan(heroScore(sign, home))
    expect(heroCandidates([sign, strip, small, team], home)[0]).toBe(team)
    expect(heroCandidates([sign, strip, small, team], home)).not.toContain(strip)
  })

  it('never offers logos and keeps one photo per alt text', () => {
    const a = photo('https://example.com/a.jpg', { alt: 'Dining room' })
    const b = photo('https://example.com/b.jpg', { alt: 'Dining room' })
    const logo: SiteImage = { ...photo('https://example.com/logo.png'), kind: 'logo' }
    expect(heroCandidates([a, b, logo], home)).toEqual([a])
  })
})
