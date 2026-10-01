import type { PsiScoreResult } from './psi-score.js'

// Weights per docs/market-discovery.md "Final score formula". Four equally-weighted
// signals rather than static vs. PSI as two 50/50 halves — performance is included at
// full weight alongside SEO/accessibility because outdated hosting/deployment is itself
// a fixable modernization pitch (e.g. migrating to Vercel), not just a neutral signal.
export const FINAL_SCORE_WEIGHTS = {
  static: 0.25,
  performance: 0.25,
  seo: 0.25,
  accessibility: 0.25,
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
 * Combines the static sub-score and the three PSI categories into the final modernity
 * score. When PSI is unavailable (no `PSI_API_KEY`, a failed request, or a malformed
 * response — see fetchPsiScore in psi-score.ts, which returns `null` for all of these),
 * degrades to the static score alone rather than throwing or blocking the pipeline on a
 * missing key.
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
      psiScore.performance * FINAL_SCORE_WEIGHTS.performance +
      psiScore.seo * FINAL_SCORE_WEIGHTS.seo +
      psiScore.accessibility * FINAL_SCORE_WEIGHTS.accessibility,
    psiAvailable: true,
  }
}
