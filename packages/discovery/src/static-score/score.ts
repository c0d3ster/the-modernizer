import {
  detectIeCompatible,
  detectNoOgTags,
  detectNoViewport,
  detectOldJquery,
  detectTableLayout,
  extractOldWpTheme,
} from './signals.js'
import { STATIC_SCORE_TOTAL_WEIGHT, STATIC_SCORE_WEIGHTS } from './weights.js'

export interface StaticScoreInput {
  html: string
  // Requires a live fetch, not derivable from the HTML string — computed by the caller.
  noSsl: boolean
  // 0-20 weight from the staleness signal — computed by the caller (see staleness.ts).
  stalenessWeight: number
}

export interface StaticScoreResult {
  score: number
  noSsl: boolean
  noViewport: boolean
  oldJquery: boolean
  oldWpTheme: boolean
  noOgTags: boolean
  tableLayout: boolean
  ieCompatible: boolean
  notes: string
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const buildNotes = (
  result: Omit<StaticScoreResult, 'score' | 'notes'>,
  wpTheme: string | null,
  stalenessWeight: number
): string => {
  const parts: string[] = []
  if (result.noSsl) parts.push('no_ssl')
  if (result.noViewport) parts.push('no_viewport')
  if (result.oldJquery) parts.push('old_jquery')
  if (result.oldWpTheme && wpTheme) parts.push(`wp-theme: ${wpTheme}`)
  if (result.tableLayout) parts.push('table_layout')
  if (result.noOgTags) parts.push('no_og_tags')
  if (result.ieCompatible) parts.push('ie_compatible')
  if (stalenessWeight > 0) parts.push(`staleness_weight: ${stalenessWeight}`)
  return parts.join(', ')
}

export const computeStaticScore = (
  input: StaticScoreInput
): StaticScoreResult => {
  const { html, noSsl, stalenessWeight } = input

  const noViewport = detectNoViewport(html)
  const oldJquery = detectOldJquery(html)
  const wpTheme = extractOldWpTheme(html)
  const oldWpTheme = wpTheme !== null
  const noOgTags = detectNoOgTags(html)
  const tableLayout = detectTableLayout(html)
  const ieCompatible = detectIeCompatible(html)

  const clampedStalenessWeight = clamp(
    stalenessWeight,
    0,
    STATIC_SCORE_WEIGHTS.staleness
  )

  const firedWeight =
    (noSsl ? STATIC_SCORE_WEIGHTS.noSsl : 0) +
    (noViewport ? STATIC_SCORE_WEIGHTS.noViewport : 0) +
    clampedStalenessWeight +
    (oldJquery ? STATIC_SCORE_WEIGHTS.oldJquery : 0) +
    (oldWpTheme ? STATIC_SCORE_WEIGHTS.oldWpTheme : 0) +
    (tableLayout ? STATIC_SCORE_WEIGHTS.tableLayout : 0) +
    (noOgTags ? STATIC_SCORE_WEIGHTS.noOgTags : 0) +
    (ieCompatible ? STATIC_SCORE_WEIGHTS.ieCompatible : 0)

  const score = 100 * (1 - firedWeight / STATIC_SCORE_TOTAL_WEIGHT)

  const signals = {
    noSsl,
    noViewport,
    oldJquery,
    oldWpTheme,
    noOgTags,
    tableLayout,
    ieCompatible,
  }

  return {
    score,
    ...signals,
    notes: buildNotes(signals, wpTheme, clampedStalenessWeight),
  }
}
