import { describe, it, expect } from 'vitest'
import type { HeaderBand, VisualFinding } from '@modernizer/schema'

import { capHeaderBarFindings, describeHeaderBars, summarizeHeaderBars } from './header-bars.js'

const band = (over: Partial<HeaderBand>): HeaderBand => ({ top: 0, height: 50, background: '#ffffff', links: 0, phone: false, logo: false, text: '', ...over })

const finding = (count: number): VisualFinding => ({ ruleId: 'header-bars', extent: 'full', count, where: 'laptop', evidence: 'bars' })

describe('summarizeHeaderBars', () => {
  it('treats the menu row and the logo row beside it as one main header', () => {
    // Shenandoah Endodontics: utility bar, logo band, menu band
    const bars = summarizeHeaderBars([
      band({ links: 5, phone: true, text: 'Patient Login' }),
      band({ height: 185, background: '#586471', links: 1, logo: true }),
      band({ links: 7, text: 'HOME | ABOUT US' }),
    ])
    expect(bars).toMatchObject({ main: [1, 2], extra: 1 })
  })

  it('counts every other band as extra', () => {
    // Farrell's: tagline bar, location bar, logo + phone, menu
    const bars = summarizeHeaderBars([band({ text: 'Leaders in HVAC' }), band({ links: 2 }), band({ links: 3, logo: true, phone: true }), band({ links: 6 })])
    expect(bars?.extra).toBe(2)
  })

  it('gives no count for a header sitting over a tall photo', () => {
    expect(summarizeHeaderBars([band({ height: 451, background: 'transparent', links: 17, logo: true })])?.extra).toBeNull()
    expect(summarizeHeaderBars([])).toBeNull()
  })

  it('describes the bands for the prompt', () => {
    const bars = summarizeHeaderBars([band({ background: '#052049', links: 8, text: 'PAYMENTS | FORMS' }), band({ background: 'image', links: 6, logo: true })])
    expect(bars && describeHeaderBars('Laptop', bars)).toBe(
      'Laptop header measured top to bottom: 2 bands, 1 beyond the main header. 1) 50px #052049: 8 links ("PAYMENTS | FORMS"); 2) 50px photo background (main header): logo, 6 links'
    )
  })
})

describe('capHeaderBarFindings', () => {
  it('never charges for more bars than were measured', () => {
    expect(capHeaderBarFindings([finding(2)], 1)).toEqual([finding(1)])
    expect(capHeaderBarFindings([finding(2)], 0)).toEqual([])
    expect(capHeaderBarFindings([finding(1)], 3)).toEqual([finding(1)])
    expect(capHeaderBarFindings([finding(2)], null)).toEqual([finding(2)])
  })
})

describe('summarizeHeaderBars content bands', () => {
  it('does not count the content below the header as a bar', () => {
    // Dr. Heather Gibson: header, then a tall cream content section
    expect(summarizeHeaderBars([band({ height: 91, links: 8, logo: true }), band({ height: 361, background: '#f3ece2', links: 2 })])?.extra).toBe(0)
  })
})
