import { COMPOSITE_WEIGHTS, PITCH_THRESHOLD } from '@modernizer/schema'
import type { CompositeSignal } from '@modernizer/schema'
import type { PsiScoreResult } from './psi-score.js'

// The weights and cutoff are part of the candidates.csv contract in @modernizer/schema. Raw PSI
// performance is left out on purpose: it ranked heavy, polished sites (video heroes, big photos)
// as worse prospects; `code` (build-quality audits) stands in for it.
export const FINAL_SCORE_WEIGHTS = COMPOSITE_WEIGHTS
export { PITCH_THRESHOLD }

export type FinalScoreSignal = CompositeSignal

const SIGNALS: readonly FinalScoreSignal[] = ['visual', 'static', 'code', 'seo', 'accessibility', 'bestPractices']

export interface FinalScoreInput {
  // 0-100 visual points, or null when the visual scorer didn't run or couldn't see the site
  visual: number | null
  // 0-100 static v2 score (always available once the homepage is fetched)
  staticScore: number
  psiScore: PsiScoreResult | null
}

export interface FinalScoreResult {
  score: number
  pitch: boolean
  // Signals that were unavailable; the rest were reweighted to fill their share
  missing: FinalScoreSignal[]
  psiAvailable: boolean
}

/**
 * Combines the signals into the 0-100 modernity score (lower = better prospect). A missing signal
 * (no PSI key, a failed PSI call, no visual score) drops out and the remaining weights are scaled
 * up to fill its share, so the score stays on the same 0-100 scale; `missing` says which were absent.
 */
export const computeFinalScore = ({ visual, staticScore, psiScore }: FinalScoreInput): FinalScoreResult => {
  const values: Record<FinalScoreSignal, number | null> = {
    visual,
    static: staticScore,
    code: psiScore?.code ?? null,
    seo: psiScore?.seo ?? null,
    accessibility: psiScore?.accessibility ?? null,
    bestPractices: psiScore?.bestPractices ?? null,
  }
  const present = SIGNALS.filter((s) => values[s] !== null)
  const totalWeight = present.reduce((sum, s) => sum + FINAL_SCORE_WEIGHTS[s], 0)
  const score = present.reduce((sum, s) => sum + (values[s] ?? 0) * FINAL_SCORE_WEIGHTS[s], 0) / totalWeight
  return {
    score,
    pitch: score < PITCH_THRESHOLD,
    missing: SIGNALS.filter((s) => values[s] === null),
    psiAvailable: psiScore !== null,
  }
}
