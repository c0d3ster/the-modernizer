import type { PsiScoreResult } from './psi-score.js'

// Weights per docs/market-discovery.md "Final score formula".
export const FINAL_SCORE_WEIGHTS = {
  static: 0.5,
  psi: 0.5,
} as const

export interface FinalScoreInput {
  staticScore: number
  psiScore: PsiScoreResult | null
}

export interface FinalScoreResult {
  score: number
  psiAvailable: boolean
}

/**
 * Combines the static and PSI sub-scores into the final modernity score. When PSI is
 * unavailable (no `PSI_API_KEY`, a failed request, or a malformed response — see
 * fetchPsiScore in psi-score.ts, which returns `null` for all of these), degrades to the
 * static score alone rather than throwing or blocking the pipeline on a missing key.
 */
export const computeFinalScore = ({
  staticScore,
  psiScore,
}: FinalScoreInput): FinalScoreResult => {
  if (psiScore === null) {
    return { score: staticScore, psiAvailable: false }
  }

  return {
    score:
      staticScore * FINAL_SCORE_WEIGHTS.static +
      psiScore.score * FINAL_SCORE_WEIGHTS.psi,
    psiAvailable: true,
  }
}
