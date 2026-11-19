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
  severity: z.enum(['major', 'minor']),
  where: z.enum(['laptop', 'phone', 'both', 'small laptop']),
  // What the screenshot shows, in plain words a business owner would follow
  evidence: z.string().min(1),
})

export const visualScoreSchema = z.object({
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

export type VisualFinding = z.infer<typeof visualFindingSchema>
export type VisualScore = z.infer<typeof visualScoreSchema>
