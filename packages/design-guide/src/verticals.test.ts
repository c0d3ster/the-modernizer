import { describe, expect, it } from 'vitest'
import { VERTICAL_IDS } from '@modernizer/schema'
import type { SiteSchema } from '@modernizer/schema'

import { designDirection } from './design-direction.js'
import { detectVertical, verticalFromBusinessType, verticalOf } from './detect-vertical.js'
import { VERTICAL_PROFILES } from './verticals.js'

const site = (siteName: string, navLabels: string[] = [], tagline?: string): Pick<SiteSchema, 'siteName' | 'tagline' | 'nav' | 'pages'> => ({
  siteName,
  tagline,
  nav: navLabels.map((label) => ({ label, url: `/${label.toLowerCase()}` })),
  pages: [],
})

describe('detectVertical', () => {
  it('reads the business type from names and menus seen on the bench', () => {
    expect(detectVertical(site('Hancock Orthodontics', ['Our Practice', 'Orthodontics', 'Patient Resources']))).toBe('dental')
    expect(detectVertical(site('Peak Dental', ['About Our Office', 'Our Services']))).toBe('dental')
    expect(detectVertical(site('J Hood Services', ['Heating', 'Cooling', 'Plumbing', 'Drains']))).toBe('home-services')
    expect(detectVertical(site('Finish Line Plumbing, LLC'))).toBe('home-services')
    expect(detectVertical(site('Antica Trattoria', ['Menu', 'Reservations', 'Gallery']))).toBe('restaurant')
    expect(detectVertical(site('Doppio Bunny Coffee', ['Locations', 'Order Online']))).toBe('cafe')
  })

  it('reads the business types discovery searches beyond the bench', () => {
    expect(detectVertical(site('Valley Collision Center', ['Collision Repair', 'Paint', 'Insurance Claims']))).toBe('auto-services')
    expect(detectVertical(site('Shenandoah Chiropractic', ['Back Pain', 'Sports Injuries', 'New Patients']))).toBe('chiropractic')
    expect(detectVertical(site('Smith Injury Lawyers', ['Car Accidents', 'Practice Areas', 'Free Consultation']))).toBe('legal')
    expect(detectVertical(site('Westside Animal Hospital', ['Dogs', 'Cats', 'Boarding']))).toBe('veterinary')
  })

  it('falls back to general when nothing points to a vertical', () => {
    expect(detectVertical(site('Edgehill Recovery', ['About', 'Programs', 'Contact']))).toBe('general')
  })

  it('prefers the vertical set on the schema', () => {
    expect(verticalOf({ ...site('Peak Dental'), vertical: 'general' })).toBe('general')
  })
})

describe('verticalFromBusinessType', () => {
  it('maps discovery business types', () => {
    expect(verticalFromBusinessType('plumber')).toBe('home-services')
    expect(verticalFromBusinessType('hvac contractor')).toBe('home-services')
    expect(verticalFromBusinessType('dentist')).toBe('dental')
    expect(verticalFromBusinessType('restaurant')).toBe('restaurant')
    expect(verticalFromBusinessType('auto body shop')).toBe('auto-services')
    expect(verticalFromBusinessType('chiropractor')).toBe('chiropractic')
    expect(verticalFromBusinessType('personal injury attorney')).toBe('legal')
    expect(verticalFromBusinessType('veterinarian')).toBe('veterinary')
    expect(verticalFromBusinessType('carpet store')).toBe('general')
  })
})

describe('profiles', () => {
  it('has a profile for every vertical, each with its own character', () => {
    for (const id of VERTICAL_IDS) expect(VERTICAL_PROFILES[id].id).toBe(id)
    const headingFonts = new Set(VERTICAL_IDS.map((id) => VERTICAL_PROFILES[id].theme.headingFont.family))
    expect(headingFonts.size).toBe(VERTICAL_IDS.length)
  })

  it('renders a design direction with the vertical guidance and the costly problems', () => {
    const text = designDirection(VERTICAL_PROFILES['home-services'])
    expect(text).toContain('Montserrat, uppercase')
    expect(text).toContain('"Schedule service"')
    expect(text).toContain('Three or four stacked header bars')
    expect(text).toContain('No responsive design')
    expect(text).not.toContain('Hard square boxes')
  })
})
