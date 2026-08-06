// Market discovery: scores candidate sites for modernization potential per docs/market-discovery.md

export { computeStaticScore } from './static-score/score.js'
export type {
  StaticScoreInput,
  StaticScoreResult,
} from './static-score/score.js'
export {
  detectIeCompatible,
  detectNoOgTags,
  detectNoViewport,
  detectOldJquery,
  detectOldWpTheme,
  detectTableLayout,
  extractOldWpTheme,
} from './static-score/signals.js'
export {
  STATIC_SCORE_TOTAL_WEIGHT,
  STATIC_SCORE_WEIGHTS,
} from './static-score/weights.js'
export { createRateLimiter } from './rate-limiter.js'
export type { RateLimiter } from './rate-limiter.js'
export {
  COPYRIGHT_FALLBACK_WEIGHT,
  computeStaleness,
  computeStalenessWeightFromYears,
  STALENESS_MAX_WEIGHT,
} from './staleness.js'
export type {
  StalenessOptions,
  StalenessResult,
  StalenessSource,
} from './staleness.js'
export { fetchCdxSnapshots } from './wayback-cdx.js'
export type { CdxSnapshot } from './wayback-cdx.js'
