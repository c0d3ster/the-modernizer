export {
  CALIBRATION_NOTES,
  DESIGN_RULES,
  PATTERN_RULES,
  PITCH_GUIDE,
  PROBLEM_RULES,
  RUBRIC_VERSION,
  RULE_AREAS,
  SCORE_LEVELS,
} from './rubric.js'
export type { DesignRule, PatternRule, ProblemRule, RuleArea, RuleScoring } from './rubric.js'
export { computeDesignPoints, deductionFor } from './points.js'
export type { Deduction, DesignPoints, PointsFinding } from './points.js'
export { VERTICAL_PROFILES, profileFor } from './verticals.js'
export type { GoogleFont, HeroVariant, PrimaryActionKind, SiteTheme, VerticalProfile } from './verticals.js'
export { detectVertical, verticalFromBusinessType, verticalOf } from './detect-vertical.js'
export { designDirection } from './design-direction.js'
