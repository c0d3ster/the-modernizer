import { describe, expect, it } from 'vitest'

import { computeFinalScore, FINAL_SCORE_WEIGHTS } from './final-score.js'
import type { PsiScoreResult } from './psi-score.js'

describe('computeFinalScore', () => {
  it('combines static and PSI sub-scores per the documented 50/50 weighting', () => {
    const psiScore: PsiScoreResult = { score: 80, performance: 70, seo: 90, accessibility: 80 }
    const result = computeFinalScore({ staticScore: 40, psiScore })

    expect(result.score).toBeCloseTo(
      40 * FINAL_SCORE_WEIGHTS.static + 80 * FINAL_SCORE_WEIGHTS.psi
    )
    expect(result.psiAvailable).toBe(true)
  })

  it('degrades to the static score alone when PSI is unavailable', () => {
    const result = computeFinalScore({ staticScore: 55, psiScore: null })

    expect(result.score).toBe(55)
    expect(result.psiAvailable).toBe(false)
  })
})
