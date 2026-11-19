import { describe, expect, it } from 'vitest'

import { computeDesignPoints, deductionFor } from './points.js'
import { DESIGN_RULES, PROBLEM_RULES } from './rubric.js'

describe('rubric', () => {
  it('gives every rule a unique id', () => {
    const ids = DESIGN_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps partial credit below the full deduction', () => {
    for (const { id, scoring } of PROBLEM_RULES) {
      if (scoring.type === 'fixed') expect(scoring.partial, id).toBeLessThan(scoring.points)
      else expect(scoring.max, id).toBeGreaterThanOrEqual(scoring.points)
    }
  })
})

describe('deductionFor', () => {
  it('charges header bars per costly extra bar, up to the cap', () => {
    const bars = (count: number): number => deductionFor({ ruleId: 'header-bars', extent: 'full', count })
    expect(bars(0)).toBe(0)
    expect(bars(1)).toBe(5)
    expect(bars(2)).toBe(10)
    expect(bars(3)).toBe(15)
    expect(bars(6)).toBe(15)
  })

  it('gives partial credit on fixed rules', () => {
    expect(deductionFor({ ruleId: 'mobile-not-responsive', extent: 'full', count: null })).toBe(30)
    expect(deductionFor({ ruleId: 'mobile-not-responsive', extent: 'partial', count: null })).toBe(15)
  })

  it('charges nothing for patterns or unknown ids', () => {
    expect(deductionFor({ ruleId: 'color-cohesive', extent: 'full', count: null })).toBe(0)
    expect(deductionFor({ ruleId: 'other', extent: 'full', count: null })).toBe(0)
  })
})

describe('computeDesignPoints', () => {
  it('starts at 100 and charges each rule once, at its worst finding', () => {
    const { score, deductions } = computeDesignPoints([
      { ruleId: 'overlay-popup-on-load', extent: 'partial', count: null },
      { ruleId: 'overlay-popup-on-load', extent: 'full', count: null },
      { ruleId: 'shape-boxy', extent: 'full', count: null },
    ])
    expect(deductions).toEqual([
      { ruleId: 'overlay-popup-on-load', points: 15 },
      { ruleId: 'shape-boxy', points: 2 },
    ])
    expect(score).toBe(83)
  })

  it('makes a major flaw cost more than several design-choice issues', () => {
    const broken = computeDesignPoints([{ ruleId: 'mobile-not-responsive', extent: 'full', count: null }])
    const picky = computeDesignPoints(['shape-boxy', 'header-not-sticky', 'nav-too-many', 'content-stale'].map((ruleId) => ({ ruleId, extent: 'full' as const, count: null })))
    expect(broken.score).toBeLessThan(picky.score)
  })

  it('never goes below 0', () => {
    const findings = ['not-own-site', 'mobile-not-responsive', 'nav-broken', 'platform-leftovers', 'cta-missing'].map((ruleId) => ({ ruleId, extent: 'full' as const, count: null }))
    expect(computeDesignPoints(findings).score).toBe(0)
  })
})
