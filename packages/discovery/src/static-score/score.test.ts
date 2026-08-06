import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { computeStaticScore } from './score.js'
import { STATIC_SCORE_TOTAL_WEIGHT, STATIC_SCORE_WEIGHTS } from './weights.js'

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures'
)

const readFixture = (name: string): string =>
  readFileSync(join(FIXTURES_DIR, name), 'utf-8')

describe('computeStaticScore', () => {
  it('scores a fully modern site at 100 with no signals fired', () => {
    const html = readFixture('fully-modern.html')
    const result = computeStaticScore({
      html,
      noSsl: false,
      stalenessWeight: 0,
    })

    expect(result.score).toBe(100)
    expect(result).toMatchObject({
      noSsl: false,
      noViewport: false,
      oldJquery: false,
      oldWpTheme: false,
      noOgTags: false,
      tableLayout: false,
      ieCompatible: false,
      notes: '',
    })
  })

  it('scores a site with every signal firing at 0', () => {
    const html = readFixture('all-signals.html')
    const result = computeStaticScore({
      html,
      noSsl: true,
      stalenessWeight: STATIC_SCORE_WEIGHTS.staleness,
    })

    expect(result.score).toBe(0)
    expect(result).toMatchObject({
      noSsl: true,
      noViewport: true,
      oldJquery: true,
      oldWpTheme: true,
      noOgTags: true,
      tableLayout: true,
      ieCompatible: true,
    })
    expect(result.notes).toContain('wp-theme: twentyfifteen')
    expect(result.notes).toContain('staleness_weight: 20')
  })

  it('matches the documented formula for a partial set of fired signals', () => {
    const html = readFixture('fully-modern.html')
    const result = computeStaticScore({ html, noSsl: true, stalenessWeight: 8 })

    const firedWeight = STATIC_SCORE_WEIGHTS.noSsl + 8
    const expectedScore = 100 * (1 - firedWeight / STATIC_SCORE_TOTAL_WEIGHT)

    expect(result.score).toBeCloseTo(expectedScore)
    expect(result.notes).toBe('no_ssl, staleness_weight: 8')
  })

  it('clamps an out-of-range staleness weight to the signal maximum', () => {
    const html = readFixture('fully-modern.html')
    const result = computeStaticScore({
      html,
      noSsl: false,
      stalenessWeight: 999,
    })

    expect(result.score).toBe(
      100 * (1 - STATIC_SCORE_WEIGHTS.staleness / STATIC_SCORE_TOTAL_WEIGHT)
    )
  })
})
