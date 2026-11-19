import { z } from 'zod'

// Issue tags used on the Site Rating Bench, so model output and hand ratings compare one to one.
export const VISUAL_ISSUES = [
  'dated-design',
  'cluttered',
  'poor-typography',
  'weak-imagery',
  'broken-layout',
  'bad-mobile',
  'no-cta',
  'low-contrast',
  'overlay',
] as const
export const visualIssueSchema = z.enum(VISUAL_ISSUES)
export type VisualIssue = z.infer<typeof visualIssueSchema>

export const PITCH_VALUES = ['yes', 'maybe', 'no'] as const
export const pitchSchema = z.enum(PITCH_VALUES)
export type Pitch = z.infer<typeof pitchSchema>

export const visualFindingSchema = z.object({
  // A rubric rule id, or "other" for a problem the rules don't name
  ruleId: z.string().min(1),
  // partial when the problem is only partly there (a small popup, a slight sideways scroll)
  extent: z.enum(['full', 'partial']),
  // For counted rules (header bars): how many units. Null for everything else.
  count: z.number().int().min(0).nullable(),
  where: z.enum(['laptop', 'phone', 'both', 'small laptop']),
  // What the screenshot shows, in plain words a business owner would follow
  evidence: z.string().min(1),
})

// What the model returns. Points are computed from the findings in code, never by the model.
export const visualScoreModelSchema = z.object({
  // The screenshots don't show the site (a bot check, an error page, a blank page)
  unassessable: z.boolean(),
  overall: z.number().int().min(1).max(5).nullable(),
  pitch: pitchSchema.nullable(),
  issues: z.array(visualIssueSchema),
  findings: z.array(visualFindingSchema),
  strengths: z.array(z.string()),
  // Things a rater would check that screenshots can't show (animation, hover, inner pages)
  cantJudge: z.array(z.string()),
  // One or two sentences in the rater's voice
  note: z.string(),
})

export const deductionSchema = z.object({ ruleId: z.string(), points: z.number().int().min(0) })

export const visualScoreSchema = visualScoreModelSchema.extend({
  // 0-100: starts at 100, minus the rubric's points for each problem found (each rule once)
  points: z.number().int().min(0).max(100).nullable(),
  deductions: z.array(deductionSchema),
  rubric: z.string(),
})

export type VisualFinding = z.infer<typeof visualFindingSchema>
export type VisualScoreModelOutput = z.infer<typeof visualScoreModelSchema>
export type VisualScore = z.infer<typeof visualScoreSchema>
