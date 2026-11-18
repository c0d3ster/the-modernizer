import { describe, expect, it } from 'vitest'
import type { CoverageItem, ViewInspection } from '@modernizer/schema'

import { coverageNotes, coversDesign, describeCoverage } from './coverage.js'

const item = (overrides: Partial<CoverageItem>): CoverageItem => ({ kind: 'floating', pct: 5, where: 'bottom', label: '', top: 700, bottom: 812, ...overrides })

const view = (viewport: ViewInspection['viewport'], covered: CoverageItem[]): ViewInspection => ({
  viewport,
  width: 1,
  height: 1,
  status: 200,
  visibleChars: 100,
  features: null,
  covered,
  screenshots: [],
})

describe('describeCoverage', () => {
  it('writes one plain line per kind', () => {
    expect(describeCoverage(item({ kind: 'cookie banner', pct: 73 }))).toBe('Cookie banner covers 73% of the first screen (bottom)')
    expect(describeCoverage(item({ kind: 'popup', pct: 40, label: 'Now Accepting New Patients!' }))).toBe(
      'Popup covers 40% of the first screen on load: "Now Accepting New Patients!"'
    )
    expect(describeCoverage(item({ kind: 'header', pct: 25 }))).toBe('Fixed header and bars take 25% of the first screen')
    expect(describeCoverage(item({ kind: 'floating', label: 'Call Us' }))).toBe('Floating element covers text ("Call Us")')
  })
})

describe('coverageNotes', () => {
  it('skips the small-laptop view, which repeats the laptop findings', () => {
    const notes = coverageNotes([view('desktop', [item({ kind: 'cookie banner', pct: 30 })]), view('small', [item({ kind: 'cookie banner', pct: 33 })])])
    expect(notes).toEqual([{ viewport: 'desktop', kind: 'cookie banner', text: 'Cookie banner covers 30% of the first screen (bottom)' }])
  })
})

describe('coversDesign', () => {
  it('is true only for banners and popups, which hide the design in a screenshot', () => {
    expect(coversDesign([item({ kind: 'floating' }), item({ kind: 'header' })])).toBe(false)
    expect(coversDesign([item({ kind: 'popup' })])).toBe(true)
  })
})
