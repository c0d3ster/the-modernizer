import { describe, expect, it } from 'vitest'

import { computeFinalScore, FINAL_SCORE_WEIGHTS, PITCH_THRESHOLD } from './final-score.js'
import type { PsiScoreResult } from './psi-score.js'

const psiScore: PsiScoreResult = { score: 80, performance: 30, seo: 90, accessibility: 80, bestPractices: 100, code: 60 }

describe('computeFinalScore', () => {
  it('weights visual at half and the five other signals at a tenth each', () => {
    expect(Object.values(FINAL_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    const result = computeFinalScore({ visual: 70, staticScore: 50, psiScore })
    expect(result.score).toBeCloseTo(0.5 * 70 + 0.1 * (50 + 60 + 90 + 80 + 100))
    expect(result.missing).toEqual([])
    expect(result.pitch).toBe(true)
  })

  it('ignores raw performance', () => {
    const slow = computeFinalScore({ visual: 70, staticScore: 50, psiScore: { ...psiScore, performance: 5 } })
    expect(slow.score).toBeCloseTo(computeFinalScore({ visual: 70, staticScore: 50, psiScore }).score)
  })

  it('reweights the remaining signals when PSI is unavailable', () => {
    const result = computeFinalScore({ visual: 80, staticScore: 40, psiScore: null })
    expect(result.score).toBeCloseTo((0.5 * 80 + 0.1 * 40) / 0.6)
    expect(result.missing).toEqual(['code', 'seo', 'accessibility', 'bestPractices'])
    expect(result.psiAvailable).toBe(false)
  })

  it('falls back to static alone when nothing else ran', () => {
    expect(computeFinalScore({ visual: null, staticScore: 55, psiScore: null }).score).toBe(55)
  })

  it('pitches below the threshold only', () => {
    const at = computeFinalScore({ visual: PITCH_THRESHOLD, staticScore: PITCH_THRESHOLD, psiScore: null })
    expect(at.pitch).toBe(false)
  })
})
