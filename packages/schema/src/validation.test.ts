import { describe, expect, it } from 'vitest'

import { PageArchetype } from './page.js'
import {
  brandColorsSchema,
  contentBlockSchema,
  ctaBlockSchema,
  faqBlockSchema,
  featureGridBlockSchema,
  heroBlockSchema,
  imageGalleryBlockSchema,
  logoCloudBlockSchema,
  navItemSchema,
  pageSchemaSchema,
  pricingTableBlockSchema,
  siteSchemaSchema,
  statsBlockSchema,
  teamGridBlockSchema,
  testimonialBlockSchema,
  textSectionBlockSchema,
} from './validation.js'

// --- HeroBlock ---

describe('heroBlockSchema', () => {
  it('accepts a minimal hero block', () => {
    expect(() =>
      heroBlockSchema.parse({ type: 'hero', heading: 'Welcome' })
    ).not.toThrow()
  })

  it('accepts all optional fields', () => {
    expect(() =>
      heroBlockSchema.parse({
        type: 'hero',
        heading: 'Welcome',
        subheading: 'Sub',
        ctaText: 'Get started',
        ctaUrl: '/start',
        backgroundImageUrl: '/img/bg.jpg',
      })
    ).not.toThrow()
  })

  it('rejects missing heading', () => {
    expect(heroBlockSchema.safeParse({ type: 'hero' }).success).toBe(false)
  })

  it('handles very long heading string', () => {
    const heading = 'a'.repeat(10000)
    expect(() => heroBlockSchema.parse({ type: 'hero', heading })).not.toThrow()
  })
})

// --- TextSectionBlock ---

describe('textSectionBlockSchema', () => {
  it('accepts block with body only', () => {
    expect(() =>
      textSectionBlockSchema.parse({ type: 'text_section', body: 'Hello' })
    ).not.toThrow()
  })

  it('accepts HTML in body', () => {
    expect(() =>
      textSectionBlockSchema.parse({
        type: 'text_section',
        body: '<p>Hello <strong>world</strong></p>',
      })
    ).not.toThrow()
  })

  it('rejects missing body', () => {
    expect(
      textSectionBlockSchema.safeParse({ type: 'text_section' }).success
    ).toBe(false)
  })
})

// --- FeatureGridBlock ---

describe('featureGridBlockSchema', () => {
  it('accepts empty features array', () => {
    expect(() =>
      featureGridBlockSchema.parse({ type: 'feature_grid', features: [] })
    ).not.toThrow()
  })

  it('accepts multiple features', () => {
    expect(() =>
      featureGridBlockSchema.parse({
        type: 'feature_grid',
        features: [
          { title: 'Fast', description: 'Very fast' },
          { title: 'Safe', description: 'Very safe', iconUrl: '/icon.svg' },
        ],
      })
    ).not.toThrow()
  })

  it('rejects feature missing title', () => {
    expect(
      featureGridBlockSchema.safeParse({
        type: 'feature_grid',
        features: [{ description: 'No title' }],
      }).success
    ).toBe(false)
  })
})

// --- TestimonialBlock ---

describe('testimonialBlockSchema', () => {
  it('accepts testimonials with required fields only', () => {
    expect(() =>
      testimonialBlockSchema.parse({
        type: 'testimonial',
        testimonials: [{ quote: 'Great!', author: 'Alice' }],
      })
    ).not.toThrow()
  })

  it('accepts empty testimonials array', () => {
    expect(() =>
      testimonialBlockSchema.parse({ type: 'testimonial', testimonials: [] })
    ).not.toThrow()
  })
})

// --- TeamGridBlock ---

describe('teamGridBlockSchema', () => {
  it('accepts member with name only', () => {
    expect(() =>
      teamGridBlockSchema.parse({
        type: 'team_grid',
        members: [{ name: 'Bob' }],
      })
    ).not.toThrow()
  })

  it('rejects member missing name', () => {
    expect(
      teamGridBlockSchema.safeParse({
        type: 'team_grid',
        members: [{ role: 'CEO' }],
      }).success
    ).toBe(false)
  })
})

// --- CTABlock ---

describe('ctaBlockSchema', () => {
  it('accepts valid cta block', () => {
    expect(() =>
      ctaBlockSchema.parse({
        type: 'cta',
        heading: 'Ready?',
        ctaText: 'Sign up',
        ctaUrl: '/signup',
      })
    ).not.toThrow()
  })

  it('rejects missing ctaUrl', () => {
    expect(
      ctaBlockSchema.safeParse({
        type: 'cta',
        heading: 'Ready?',
        ctaText: 'Sign up',
      }).success
    ).toBe(false)
  })
})

// --- FAQBlock ---

describe('faqBlockSchema', () => {
  it('accepts empty items array', () => {
    expect(() =>
      faqBlockSchema.parse({ type: 'faq', items: [] })
    ).not.toThrow()
  })

  it('accepts valid faq items', () => {
    expect(() =>
      faqBlockSchema.parse({
        type: 'faq',
        items: [{ question: 'Why?', answer: 'Because.' }],
      })
    ).not.toThrow()
  })
})

// --- StatsBlock ---

describe('statsBlockSchema', () => {
  it('accepts valid stats', () => {
    expect(() =>
      statsBlockSchema.parse({
        type: 'stats',
        stats: [{ value: '100+', label: 'Clients' }],
      })
    ).not.toThrow()
  })

  it('accepts empty stats array', () => {
    expect(() =>
      statsBlockSchema.parse({ type: 'stats', stats: [] })
    ).not.toThrow()
  })
})

// --- ImageGalleryBlock ---

describe('imageGalleryBlockSchema', () => {
  it('accepts images with url only', () => {
    expect(() =>
      imageGalleryBlockSchema.parse({
        type: 'image_gallery',
        images: [{ url: '/img/photo.jpg' }],
      })
    ).not.toThrow()
  })

  it('rejects image missing url', () => {
    expect(
      imageGalleryBlockSchema.safeParse({
        type: 'image_gallery',
        images: [{ alt: 'no url here' }],
      }).success
    ).toBe(false)
  })
})

// --- PricingTableBlock ---

describe('pricingTableBlockSchema', () => {
  it('accepts valid pricing tier', () => {
    expect(() =>
      pricingTableBlockSchema.parse({
        type: 'pricing_table',
        tiers: [{ name: 'Pro', price: '$99/mo', features: ['Feature A'] }],
      })
    ).not.toThrow()
  })

  it('accepts empty features array on tier', () => {
    expect(() =>
      pricingTableBlockSchema.parse({
        type: 'pricing_table',
        tiers: [{ name: 'Free', price: '$0', features: [] }],
      })
    ).not.toThrow()
  })
})

// --- LogoCloudBlock ---

describe('logoCloudBlockSchema', () => {
  it('accepts valid logos', () => {
    expect(() =>
      logoCloudBlockSchema.parse({
        type: 'logo_cloud',
        logos: [{ name: 'Acme', imageUrl: '/acme.svg' }],
      })
    ).not.toThrow()
  })
})

// --- contentBlockSchema (discriminated union) ---

describe('contentBlockSchema', () => {
  it('routes to correct schema by type', () => {
    expect(() =>
      contentBlockSchema.parse({ type: 'hero', heading: 'Hi' })
    ).not.toThrow()
    expect(() =>
      contentBlockSchema.parse({ type: 'text_section', body: 'Body text' })
    ).not.toThrow()
    expect(() =>
      contentBlockSchema.parse({ type: 'generic_section', rawHtml: '<div/>' })
    ).not.toThrow()
  })

  it('rejects unknown type', () => {
    expect(
      contentBlockSchema.safeParse({ type: 'unknown_block', data: 'x' }).success
    ).toBe(false)
  })

  it('rejects block with wrong type discriminant fields', () => {
    expect(
      contentBlockSchema.safeParse({ type: 'cta', heading: 'Hi' }).success
    ).toBe(false) // missing ctaText and ctaUrl
  })
})

// --- pageSchemaSchema ---

describe('pageSchemaSchema', () => {
  it('accepts a valid page', () => {
    expect(() =>
      pageSchemaSchema.parse({
        url: 'https://example.com',
        title: 'Home',
        archetype: PageArchetype.Home,
        blocks: [],
      })
    ).not.toThrow()
  })

  it('accepts optional metaDescription', () => {
    expect(() =>
      pageSchemaSchema.parse({
        url: 'https://example.com/about',
        title: 'About',
        archetype: PageArchetype.About,
        metaDescription: 'About us',
        blocks: [],
      })
    ).not.toThrow()
  })

  it('rejects invalid archetype', () => {
    expect(
      pageSchemaSchema.safeParse({
        url: 'https://example.com',
        title: 'Home',
        archetype: 'not_an_archetype',
        blocks: [],
      }).success
    ).toBe(false)
  })

  it('rejects missing url', () => {
    expect(
      pageSchemaSchema.safeParse({
        title: 'Home',
        archetype: PageArchetype.Home,
        blocks: [],
      }).success
    ).toBe(false)
  })
})

// --- brandColorsSchema ---

describe('brandColorsSchema', () => {
  it('accepts primary only', () => {
    expect(() =>
      brandColorsSchema.parse({ primary: '#0070f3' })
    ).not.toThrow()
  })

  it('accepts all color fields', () => {
    expect(() =>
      brandColorsSchema.parse({
        primary: '#0070f3',
        secondary: '#ff4500',
        accent: '#00b894',
        background: '#ffffff',
        text: '#111111',
      })
    ).not.toThrow()
  })

  it('rejects missing primary', () => {
    expect(
      brandColorsSchema.safeParse({ secondary: '#ff4500' }).success
    ).toBe(false)
  })
})

// --- navItemSchema (recursive) ---

describe('navItemSchema', () => {
  it('accepts flat nav item', () => {
    expect(() =>
      navItemSchema.parse({ label: 'Home', url: '/' })
    ).not.toThrow()
  })

  it('accepts nested children', () => {
    expect(() =>
      navItemSchema.parse({
        label: 'Services',
        url: '/services',
        children: [
          { label: 'Web', url: '/services/web' },
          {
            label: 'Mobile',
            url: '/services/mobile',
            children: [{ label: 'iOS', url: '/services/mobile/ios' }],
          },
        ],
      })
    ).not.toThrow()
  })
})

// --- siteSchemaSchema ---

describe('siteSchemaSchema', () => {
  it('accepts a minimal valid site', () => {
    expect(() =>
      siteSchemaSchema.parse({
        rootUrl: 'https://example.com',
        siteName: 'Example',
        brandColors: { primary: '#0070f3' },
        nav: [],
        pages: [],
      })
    ).not.toThrow()
  })

  it('rejects missing siteName', () => {
    expect(
      siteSchemaSchema.safeParse({
        rootUrl: 'https://example.com',
        brandColors: { primary: '#0070f3' },
        nav: [],
        pages: [],
      }).success
    ).toBe(false)
  })

  it('accepts a full site with pages and blocks', () => {
    expect(() =>
      siteSchemaSchema.parse({
        rootUrl: 'https://example.com',
        siteName: 'Example',
        tagline: 'We do things',
        brandColors: { primary: '#0070f3' },
        nav: [{ label: 'Home', url: '/' }],
        pages: [
          {
            url: 'https://example.com',
            title: 'Home',
            archetype: PageArchetype.Home,
            blocks: [{ type: 'hero', heading: 'Welcome' }],
          },
        ],
      })
    ).not.toThrow()
  })
})
