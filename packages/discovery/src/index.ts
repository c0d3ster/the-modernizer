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
export { computePsiScore, fetchPsiScore, PSI_SCORE_WEIGHTS } from './psi-score.js'
export type { PsiCategoryScores, PsiScoreOptions, PsiScoreResult } from './psi-score.js'
export { computeFinalScore, FINAL_SCORE_WEIGHTS } from './final-score.js'
export type { FinalScoreInput, FinalScoreResult } from './final-score.js'
export { inspectSite, launchInspectionBrowser } from './inspect/inspect-site.js'
export type { InspectSiteOptions } from './inspect/inspect-site.js'
export { INSPECTION_VIEWPORTS } from './inspect/viewports.js'
export type { InspectionViewport } from './inspect/viewports.js'
export { detectProjectFeatures } from './inspect/project-features.js'
export type { ProjectFeatureInput } from './inspect/project-features.js'
export { smallLaptopIssues } from './inspect/small-laptop.js'
export { coverageNotes, coversDesign, describeCoverage } from './inspect/coverage.js'
export { CALIBRATION_NOTES, DESIGN_RULES, PITCH_GUIDE, RUBRIC_VERSION, RULE_AREAS, SCORE_LEVELS } from './visual-score/rubric.js'
export type { DesignRule, RuleArea } from './visual-score/rubric.js'
export { describeInspectionFacts } from './visual-score/inspection-facts.js'
export {
  VISUAL_SCORE_TOOL,
  buildVisualScoreRequest,
  parseVisualScore,
  scoreSiteVisually,
  visualScoreInputFromInspection,
} from './visual-score/visual-score.js'
export type { LabeledImage, VisualScoreInput, VisualScoreOptions, VisualScoreResult } from './visual-score/visual-score.js'
