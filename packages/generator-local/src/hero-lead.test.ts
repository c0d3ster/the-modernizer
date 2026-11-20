import { describe, expect, it } from 'vitest'
import { PageArchetype } from '@modernizer/schema'
import type { SiteSchema } from '@modernizer/schema'

import { shortenHeroLeads, splitLead } from './hero-lead.js'

const ROBBIES =
  "Your Trusted and Reliable Auto Body Repair Shop in Winchester, VA! For over 35 years, Robbie's Auto Body Inc. has been Winchester's trusted destination for exceptional collision repair services. Since 1989, we've proudly restored vehicles to their pre-accident condition. Contact us today at 540-868-1250!"

describe('splitLead', () => {
  it('keeps a short subheading whole', () => {
    expect(splitLead('Family dentistry in Winchester.')).toEqual({ lead: 'Family dentistry in Winchester.', rest: '' })
  })

  it('keeps whole sentences that fit and returns the rest', () => {
    const { lead, rest } = splitLead(ROBBIES)
    expect(lead).toBe('Your Trusted and Reliable Auto Body Repair Shop in Winchester, VA!')
    expect(rest.startsWith("For over 35 years, Robbie's Auto Body Inc. has been")).toBe(true)
    expect(`${lead} ${rest}`).toBe(ROBBIES)
  })

  it('does not split inside "Inc." or a decimal', () => {
    const { lead } = splitLead(`Smith Inc. has served 2.5 counties since 1990. ${'More detail follows here. '.repeat(10)}`, 60)
    expect(lead).toBe('Smith Inc. has served 2.5 counties since 1990.')
  })

  it('gives no lead when the first sentence alone is too long', () => {
    const long = `${'word '.repeat(60).trim()}. Short one.`
    expect(splitLead(long)).toEqual({ lead: '', rest: long })
  })
})

describe('shortenHeroLeads', () => {
  const schema = (subheading: string): SiteSchema => ({
    rootUrl: 'https://robbies.example.com/',
    siteName: "Robbie's Auto Body",
    brandColors: { primary: '#b91c1c' },
    nav: [],
    pages: [
      {
        url: 'https://robbies.example.com/',
        title: 'Home',
        archetype: PageArchetype.Home,
        blocks: [
          { type: 'hero', heading: 'Your Premier Auto Body Repair Shop', subheading, ctaText: 'Call Us Now', ctaUrl: 'tel:5408681250' },
          { type: 'text_section', body: 'Services' },
        ],
      },
    ],
  })

  it('moves the overflow into a text section right after the hero', () => {
    const [hero, moved, next] = shortenHeroLeads(schema(ROBBIES)).pages[0]?.blocks ?? []
    expect(hero).toMatchObject({ type: 'hero', subheading: 'Your Trusted and Reliable Auto Body Repair Shop in Winchester, VA!', ctaText: 'Call Us Now' })
    expect(moved).toMatchObject({ type: 'text_section' })
    expect(next).toEqual({ type: 'text_section', body: 'Services' })
  })

  it('drops the subheading when no sentence fits', () => {
    const long = `${'word '.repeat(60).trim()}.`
    const [hero, moved] = shortenHeroLeads(schema(`${long} ${long}`)).pages[0]?.blocks ?? []
    expect(hero).not.toHaveProperty('subheading')
    expect(moved).toEqual({ type: 'text_section', body: `${long} ${long}` })
  })

  it('leaves short heroes untouched', () => {
    const input = schema('Collision repair since 1989.')
    expect(shortenHeroLeads(input)).toEqual(input)
  })
})
