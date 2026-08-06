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
