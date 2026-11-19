import type Anthropic from '@anthropic-ai/sdk'
import { PROBLEM_RULES } from '@modernizer/design-guide'
import { findingCheckSchema } from '@modernizer/schema'
import type { FindingCheck, VisualFinding } from '@modernizer/schema'
import { z } from 'zod'

// The scorer applies most rules well but sometimes charges a rule whose own exception covers the
// site (a second header bar with unique links, a site called dated for a bold palette). A second
// look, one finding at a time with the rule text beside it, catches those before points are counted.

export const VERIFY_TOOL_NAME = 'record_finding_checks'

export const VERIFY_TOOL: Anthropic.Tool = {
  name: VERIFY_TOOL_NAME,
  description: 'Record the second look at each finding: keep it, soften it to partial, or drop it.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['checks'],
    properties: {
      checks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'verdict', 'count', 'reason'],
          properties: {
            index: { type: 'integer', description: 'The finding number' },
            verdict: { type: 'string', enum: ['keep', 'partial', 'drop'] },
            count: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Corrected count for counted rules, otherwise null' },
            reason: { type: 'string', description: 'One sentence: which part of the rule or screenshot decided it' },
          },
        },
      },
    },
  },
}

// Rules whose exception or threshold the scorer has been seen to skip. On the 48-site bench, rechecking
// every finding dropped real problems it merely couldn't confirm (points spearman 0.73 -> 0.62), and
// rechecking mobile-little-info and cta-missing also hurt; these two helped (0.61 -> 0.65 on one run).
export const EXCEPTION_RULES: ReadonlySet<string> = new Set(['dated-overall', 'header-bars'])

/** The findings worth a second look, with their positions in the full list. */
export const findingsToCheck = (findings: readonly VisualFinding[]): { index: number; finding: VisualFinding }[] =>
  findings.flatMap((finding, index) => (EXCEPTION_RULES.has(finding.ruleId) ? [{ index, finding }] : []))

const ruleText = (ruleId: string): string => PROBLEM_RULES.find((r) => r.id === ruleId)?.rule ?? 'No rubric rule; a problem the rules do not name.'

/** The follow-up question, listing each finding with the full text of the rule it charges. */
export const verifyFindingsText = (items: readonly { index: number; finding: VisualFinding }[]): string => `
Before the points are counted, check these findings against the exceptions and thresholds written into their rules. Reread each rule below and look again at the screenshots and measured facts.

- keep: the rule applies as written. This is the default; keep the finding unless the rule's own exception or threshold clearly rules it out.
- partial: the rule names a partial case and that is what the site shows (for example, exactly two dated signals).
- drop: an exception written in the rule clearly applies (a second bar whose links appear nowhere else up front, a strong palette that is a design choice rather than a sign of age), or the rule's threshold is not met (fewer dated signals than it requires).

Do not drop a finding because it is hard to confirm or because the site is good overall. For counted rules, give the corrected count.

${items.map(({ index, finding: f }) => `Finding ${index}: [${f.ruleId}] ${f.extent}${f.count !== null ? `, count ${f.count}` : ''}, ${f.where}. Evidence: ${f.evidence}\nRule: ${ruleText(f.ruleId)}`).join('\n\n')}

Call ${VERIFY_TOOL_NAME} with one check per finding, using its finding number as the index.
`.trim()

const checksSchema = z.object({ checks: z.array(findingCheckSchema) })

export const parseFindingChecks = (toolInput: unknown): FindingCheck[] => checksSchema.parse(toolInput).checks

/**
 * Applies the checks: dropped findings go, softened ones become partial, counts take the corrected
 * value. A finding with no check is kept as it was.
 */
export const applyFindingChecks = (findings: readonly VisualFinding[], checks: readonly FindingCheck[]): VisualFinding[] =>
  findings.flatMap((finding, index) => {
    const check = checks.find((c) => c.index === index)
    if (!check) return [finding]
    if (check.verdict === 'drop') return []
    const count = finding.count !== null && check.count !== null ? check.count : finding.count
    if (count === 0) return []
    return [{ ...finding, count, extent: check.verdict === 'partial' ? 'partial' : finding.extent }]
  })
