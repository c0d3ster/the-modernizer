import { describe, it, expect } from 'vitest'
import type { ContentBlock } from '@modernizer/schema'

import { tidyHomeBlocks } from './tidy-home.js'

const about: ContentBlock = { type: 'text_section', heading: 'About', body: 'We have cooked here since the old days.' }

describe('tidyHomeBlocks', () => {
  it('drops a band that repeats the hero and puts the chosen photo on it', () => {
    const blocks: ContentBlock[] = [
      { type: 'generic_section', rawHtml: '<h1>Mangia Cucina</h1><p>Italian restaurant in Winchester</p>' },
      { type: 'hero', heading: 'Mangia Cucina', subheading: 'Italian restaurant in Winchester', backgroundImageUrl: 'sign.jpg' },
      about,
    ]
    expect(tidyHomeBlocks(blocks, 'food.jpg')).toEqual([
      { type: 'hero', heading: 'Mangia Cucina', subheading: 'Italian restaurant in Winchester', backgroundImageUrl: 'food.jpg' },
      about,
    ])
  })

  it('merges two heroes in a row, keeping the one with a subheading and action', () => {
    const blocks: ContentBlock[] = [
      { type: 'hero', heading: 'Acme Plumbing - Certified Master Plumber - Winchester, VA - Berryville, VA - Martinsburg, WV', backgroundImageUrl: 'pipes.jpg' },
      { type: 'hero', heading: 'Fast, reliable plumbing', subheading: 'Open 24/7', ctaText: 'Call now', ctaUrl: 'tel:1' },
      about,
    ]
    const [hero, ...rest] = tidyHomeBlocks(blocks)
    expect(hero).toMatchObject({ heading: 'Fast, reliable plumbing', ctaText: 'Call now', backgroundImageUrl: 'pipes.jpg' })
    expect(rest).toEqual([about])
  })

  it('keeps a real section that comes before the hero, after it', () => {
    const notice: ContentBlock = { type: 'text_section', body: 'Closed on Thanksgiving day this year.' }
    const hero: ContentBlock = { type: 'hero', heading: 'Welcome' }
    expect(tidyHomeBlocks([notice, hero])).toEqual([hero, notice])
  })
})
