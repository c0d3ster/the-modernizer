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
const categoryScore = z.object({ score: z.number().min(0).max(1) })

const PsiResponseSchema = z.object({
  lighthouseResult: z.object({
    categories: z.object({
      performance: categoryScore,
      seo: categoryScore,
      accessibility: categoryScore,
      // Requested too, but optional so an older or partial result still scores the rest
      'best-practices': categoryScore.optional(),
    }),
    audits: z.record(z.string(), z.object({ score: z.number().min(0).max(1).nullable().optional() })).optional(),
  }),
})

/**
 * Build-quality audits that tracked the hand-rated pitch calls on the Winchester bench, unlike
 * the performance category itself (which ranks heavy, polished sites low). Each entry lists the
 * Lighthouse 13 insight id first, then the id older Lighthouse versions used.
 */
export const CODE_AUDITS: readonly (readonly string[])[] = [
  ['legacy-javascript-insight', 'legacy-javascript'],
  ['font-display-insight', 'font-display'],
  ['duplicated-javascript-insight', 'duplicated-javascript'],
  ['bootup-time'],
  ['unsized-images'],
]

export interface PsiCategoryScores {
  performance: number
  seo: number
  accessibility: number
}

export interface PsiScoreResult extends PsiCategoryScores {
  score: number
  // 0-100, null when PSI didn't return the category
  bestPractices: number | null
  // 0-100 mean of CODE_AUDITS (an audit Lighthouse skipped counts as passed); null when no audits came back
  code: number | null
}

type PsiAudits = Record<string, { score?: number | null }>

/** Mean score of the build-quality audits, 0-100. */
export const computeCodeScore = (audits: PsiAudits | undefined): number | null => {
  if (!audits || Object.keys(audits).length === 0) return null
  const scores = CODE_AUDITS.map((ids) => ids.map((id) => audits[id]?.score).find((s): s is number => typeof s === 'number') ?? 1)
  return (100 * scores.reduce((sum, s) => sum + s, 0)) / scores.length
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
  // PSI defaults to performance-only if no `category` param is sent, which would
  // otherwise fail PsiResponseSchema validation (all three categories are required).
  params.append('category', 'performance')
  params.append('category', 'seo')
  params.append('category', 'accessibility')
  params.append('category', 'best-practices')

  try {
    // Complex/large pages (verified live against amazon.com) can take 45-55s for PSI to
    // run a full Lighthouse audit, well past 30s — our actual target sites (small, static
    // brochure sites) finish much faster, so 60s costs nothing on the common path.
    const response = await fetchImpl(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) return null

    const json: unknown = await response.json()
    const parsed = PsiResponseSchema.safeParse(json)
    if (!parsed.success) return null

    const { categories: raw, audits } = parsed.data.lighthouseResult
    const categories: PsiCategoryScores = {
      performance: raw.performance.score * 100,
      seo: raw.seo.score * 100,
      accessibility: raw.accessibility.score * 100,
    }
    const bestPractices = raw['best-practices'] ? raw['best-practices'].score * 100 : null

    return { ...categories, score: computePsiScore(categories), bestPractices, code: computeCodeScore(audits) }
  } catch {
    return null
  }
}
