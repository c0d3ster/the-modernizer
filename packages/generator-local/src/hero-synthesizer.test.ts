import { describe, it, expect } from 'vitest'
import { PageArchetype } from '@modernizer/schema'
import type { SiteImage, SiteSchema } from '@modernizer/schema'

import { synthesizeGallery, synthesizeHero } from './hero-synthesizer.js'

const rootUrl = 'https://example.com/'
const photo = (n: number): SiteImage => ({ url: `https://example.com/p${n}.jpg`, kind: 'photo', pageUrl: rootUrl, order: n })

const site = (overrides: Partial<SiteSchema> = {}): SiteSchema => ({
  siteName: 'Acme',
  rootUrl,
  brandColors: { primary: '#225588' },
  nav: [],
  pages: [
    {
      url: rootUrl,
      title: 'Home',
      archetype: PageArchetype.Home,
      blocks: [
        { type: 'hero', heading: 'Welcome', backgroundImageUrl: 'https://example.com/p0.jpg' },
        { type: 'text_section', heading: 'About', body: 'We fix things.' },
        { type: 'cta', heading: 'Call us', ctaText: 'Call', ctaUrl: 'tel:1' },
      ],
    },
  ],
  ...overrides,
})

describe('synthesizeGallery', () => {
  it('adds the site photos before the closing call to action, skipping the hero photo', () => {
    const result = synthesizeGallery(site({ images: [0, 1, 2, 3].map(photo), heroImageUrl: 'https://example.com/p0.jpg' }))
    const blocks = result.pages[0]!.blocks
    expect(blocks.map((b) => b.type)).toEqual(['hero', 'text_section', 'image_gallery', 'cta'])
    const gallery = blocks[2]
    expect(gallery?.type === 'image_gallery' && gallery.images.map((i) => i.url)).toEqual([1, 2, 3].map((n) => `https://example.com/p${n}.jpg`))
  })

  it('leaves the page alone with fewer than three spare photos', () => {
    const schema = site({ images: [0, 1, 2].map(photo) })
    expect(synthesizeGallery(schema)).toBe(schema)
  })
})

describe('synthesizeHero', () => {
  it('uses the chosen hero photo over an og:image that is the logo', () => {
    const base = site({ heroImageUrl: 'https://example.com/team.jpg', logoUrl: 'https://example.com/logo.gif' })
    const schema: SiteSchema = { ...base, pages: [{ ...base.pages[0]!, ogImage: 'https://example.com/logo.gif', blocks: [] }] }
    const hero = synthesizeHero(schema).pages[0]!.blocks[0]
    expect(hero?.type === 'hero' && hero.backgroundImageUrl).toBe('https://example.com/team.jpg')
  })
})
