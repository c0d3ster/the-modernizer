import { z } from 'zod'

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

// Weights per docs/market-discovery.md "Sub-score 2: Lighthouse / PSI" — SEO and
// accessibility outweigh raw performance since server speed isn't a design-neglect signal.
export const PSI_SCORE_WEIGHTS = {
  performance: 0.3,
  seo: 0.4,
  accessibility: 0.3,
} as const

// Untrusted external API boundary — validated rather than cast. A missing category
// (malformed/partial result) fails validation entirely rather than silently scoring
// with a zeroed-out category, since that would produce a misleadingly confident number.
const PsiResponseSchema = z.object({
  lighthouseResult: z.object({
    categories: z.object({
      performance: z.object({ score: z.number().min(0).max(1) }),
      seo: z.object({ score: z.number().min(0).max(1) }),
      accessibility: z.object({ score: z.number().min(0).max(1) }),
    }),
  }),
})

export interface PsiCategoryScores {
  performance: number
  seo: number
  accessibility: number
}

export interface PsiScoreResult extends PsiCategoryScores {
  score: number
}

export interface PsiScoreOptions {
  apiKey?: string
  fetchImpl?: typeof fetch
}

// Pure formula, split out so it can be unit-tested directly against fixture category
// scores without a network call. Inputs are 0-100 (already multiplied up from the raw
// 0-1 Lighthouse scores), matching the static score's 0-100 range.
export const computePsiScore = (categories: PsiCategoryScores): number =>
  categories.performance * PSI_SCORE_WEIGHTS.performance +
  categories.seo * PSI_SCORE_WEIGHTS.seo +
  categories.accessibility * PSI_SCORE_WEIGHTS.accessibility

/**
 * Fetches Lighthouse category scores from the PageSpeed Insights API for a single URL and
 * combines them into the PSI sub-score. Auto-degrades to `null` — never throws — whenever
 * PSI can't produce a usable result: no `PSI_API_KEY` set, a failed HTTP request, or a
 * malformed/partial response. The caller (see final-score.ts) treats `null` as "PSI
 * unavailable" and falls back to a static-only final score.
 */
export const fetchPsiScore = async (
  url: string,
  { apiKey = process.env['PSI_API_KEY'], fetchImpl = fetch }: PsiScoreOptions = {}
): Promise<PsiScoreResult | null> => {
  if (!apiKey) return null

  const params = new URLSearchParams({ url, strategy: 'mobile', key: apiKey })

  try {
    const response = await fetchImpl(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return null

    const json: unknown = await response.json()
    const parsed = PsiResponseSchema.safeParse(json)
    if (!parsed.success) return null

    const { performance, seo, accessibility } = parsed.data.lighthouseResult.categories
    const categories: PsiCategoryScores = {
      performance: performance.score * 100,
      seo: seo.score * 100,
      accessibility: accessibility.score * 100,
    }

    return { ...categories, score: computePsiScore(categories) }
  } catch {
    return null
  }
}
