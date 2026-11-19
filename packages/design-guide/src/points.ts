import { PROBLEM_RULES, type ProblemRule } from './rubric.js'

export interface PointsFinding {
  ruleId: string
  // "partial" when the problem is only partly there (a small popup, a slight sideways scroll)
  extent: 'full' | 'partial'
  // For counted rules: how many units (e.g. costly extra header bars). Ignored for fixed rules.
  count: number | null
}

export interface Deduction {
  ruleId: string
  points: number
}

export interface DesignPoints {
  // 0-100, absolute: the same site always scores the same, whatever else was scored alongside it
  score: number
  deductions: Deduction[]
}

const RULES_BY_ID = new Map<string, ProblemRule>(PROBLEM_RULES.map((r) => [r.id, r]))

/** Points one finding costs under its rule, or 0 when it names no problem rule. */
export const deductionFor = ({ ruleId, extent, count }: PointsFinding): number => {
  const rule = RULES_BY_ID.get(ruleId)
  if (!rule) return 0
  const { scoring } = rule
  if (scoring.type === 'per-unit') return Math.min(scoring.max, Math.max(0, Math.round(count ?? 1)) * scoring.points)
  return extent === 'partial' ? scoring.partial : scoring.points
}

/**
 * Scores a site out of 100 from its findings. Each rule counts once, at its worst finding, so the
 * same problem seen on laptop and phone is not charged twice.
 */
export const computeDesignPoints = (findings: readonly PointsFinding[]): DesignPoints => {
  const worst = new Map<string, number>()
  for (const finding of findings) {
    const points = deductionFor(finding)
    if (points > (worst.get(finding.ruleId) ?? 0)) worst.set(finding.ruleId, points)
  }
  const deductions = [...worst.entries()].map(([ruleId, points]) => ({ ruleId, points })).sort((a, b) => b.points - a.points)
  const lost = deductions.reduce((sum, d) => sum + d.points, 0)
  return { score: Math.max(0, 100 - lost), deductions }
}
