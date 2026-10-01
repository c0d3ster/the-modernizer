import { describe, expect, it } from 'vitest'

import { computeFinalScore, FINAL_SCORE_WEIGHTS } from './final-score.js'
import type { PsiScoreResult } from './psi-score.js'

describe('computeFinalScore', () => {
  it('combines static score and PSI categories per the documented equal 25% weighting', () => {
    const psiScore: PsiScoreResult = { score: 80, performance: 70, seo: 90, accessibility: 80 }
    const result = computeFinalScore({ staticScore: 40, psiScore })

    expect(result.score).toBeCloseTo(
      40 * FINAL_SCORE_WEIGHTS.static +
        70 * FINAL_SCORE_WEIGHTS.performance +
        90 * FINAL_SCORE_WEIGHTS.seo +
        80 * FINAL_SCORE_WEIGHTS.accessibility
    )
    expect(result.psiAvailable).toBe(true)
  })

  it('degrades to the static score alone when PSI is unavailable', () => {
    const result = computeFinalScore({ staticScore: 55, psiScore: null })

    expect(result.score).toBe(55)
    expect(result.psiAvailable).toBe(false)
  })
})
