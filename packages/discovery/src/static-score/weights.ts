// Weights per docs/market-discovery.md "Sub-score 1: Static HTML".
// Non-staleness signals sum to 80; staleness fills the remaining 20, for a total of 100.
export const STATIC_SCORE_WEIGHTS = {
  noSsl: 20,
  noViewport: 20,
  staleness: 20,
  oldJquery: 12,
  oldWpTheme: 10,
  tableLayout: 10,
  noOgTags: 5,
  ieCompatible: 3,
} as const

export const STATIC_SCORE_TOTAL_WEIGHT = 100
