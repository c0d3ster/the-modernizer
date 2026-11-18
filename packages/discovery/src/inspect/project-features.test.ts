import { describe, expect, it } from 'vitest'

import { detectProjectFeatures } from './project-features.js'
import { pageFeatures } from './test-fixtures.js'

const featuresOf = (input: Parameters<typeof detectProjectFeatures>[0]): string[] => detectProjectFeatures(input).map((f) => f.feature)

describe('detectProjectFeatures', () => {
  it('reports nothing when the laptop pass failed', () => {
    expect(detectProjectFeatures({ laptop: null, mobile: pageFeatures({ chat: 'Podium' }), small: null })).toEqual([])
  })

  it('reports nothing for a page with nothing detected', () => {
    expect(detectProjectFeatures({ laptop: pageFeatures(), mobile: pageFeatures(), small: pageFeatures() })).toEqual([])
  })

  it('counts a site as responsive only when the phone view has a viewport tag and no real sideways scroll', () => {
    const laptop = pageFeatures()
    expect(featuresOf({ laptop, mobile: pageFeatures({ viewportMeta: true, overflowPx: 12 }), small: null })).toContain('responsive_design')
    expect(featuresOf({ laptop, mobile: pageFeatures({ viewportMeta: true, overflowPx: 140 }), small: null })).not.toContain('responsive_design')
    expect(featuresOf({ laptop, mobile: pageFeatures({ viewportMeta: false }), small: null })).not.toContain('responsive_design')
  })

  it('needs a title, description and either social tags or business schema for SEO', () => {
    const seo = { title: true, metaDescription: true, ogTags: false, localBusiness: false, h1: 1, canonical: true }
    expect(featuresOf({ laptop: pageFeatures({ seo }), mobile: null, small: null })).not.toContain('seo')
    const found = detectProjectFeatures({ laptop: pageFeatures({ seo: { ...seo, localBusiness: true } }), mobile: null, small: null })
    expect(found).toContainEqual({ feature: 'seo', label: 'SEO Setup', detail: 'Title, description, business schema' })
  })

  it('labels financing vendors as financing and falls back to a pay link', () => {
    const [financing] = detectProjectFeatures({ laptop: pageFeatures({ payments: ['CareCredit', 'Square'] }), mobile: null, small: null })
    expect(financing?.detail).toBe('CareCredit financing, Square')
    const [link] = detectProjectFeatures({ laptop: pageFeatures({ payLink: true }), mobile: null, small: null })
    expect(link).toMatchObject({ feature: 'payment_processing', detail: 'Pay online link' })
  })

  it('describes restaurant ordering separately from a store platform', () => {
    const [toast] = detectProjectFeatures({ laptop: pageFeatures({ ordering: 'Toast' }), mobile: null, small: null })
    expect(toast?.detail).toBe('Online ordering (Toast)')
    const [shop] = detectProjectFeatures({ laptop: pageFeatures({ ordering: 'Shopify' }), mobile: null, small: null })
    expect(shop?.detail).toBe('Shopify store')
  })

  it('picks up booking from the main button when no booking widget was found', () => {
    const laptop = pageFeatures({ ctas: [{ text: 'Book now', goesTo: 'online booking (LocalMed)' }] })
    expect(detectProjectFeatures({ laptop, mobile: null, small: null })).toContainEqual({ feature: 'online_booking', label: 'Online Booking', detail: 'LocalMed' })
  })

  it('checks every view for chat and reviews, since some widgets only load on mobile', () => {
    const found = detectProjectFeatures({
      laptop: pageFeatures(),
      mobile: pageFeatures({ chat: 'chat button', testimonials: true }),
      small: null,
    })
    expect(found).toContainEqual({ feature: 'live_chat', label: 'Live Chat', detail: 'Chat button on the site' })
    expect(found).toContainEqual({ feature: 'reviews', label: 'Reviews & Testimonials', detail: 'Reviews or testimonials shown' })
  })

  it('prefers a named review widget over plain testimonials', () => {
    const laptop = pageFeatures({ testimonials: true, reviewWidget: 'Elfsight' })
    expect(detectProjectFeatures({ laptop, mobile: null, small: null })).toContainEqual({ feature: 'reviews', label: 'Reviews & Testimonials', detail: 'Elfsight widget' })
  })

  it('only counts known site builders as a CMS', () => {
    expect(featuresOf({ laptop: pageFeatures({ platform: ['WordPress', 'Cloudflare'] }), mobile: null, small: null })).toEqual(['cms_integration'])
    expect(featuresOf({ laptop: pageFeatures({ platform: ['Cloudflare'] }), mobile: null, small: null })).toEqual([])
  })
})
