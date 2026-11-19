import { readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { RUBRIC_VERSION, computeDesignPoints } from '@modernizer/design-guide'
import { PITCH_VALUES, VISUAL_ISSUES, visualScoreModelSchema } from '@modernizer/schema'
import type { SiteInspection, VisualScore } from '@modernizer/schema'

import { describeInspectionFacts } from './inspection-facts.js'
import { visualScoreSystemPrompt, visualScoreUserText } from './prompts/visual-score.js'

const MODEL = 'claude-sonnet-5'
// claude-sonnet-5 list price, $ per million tokens (Nov 2026). Cache writes bill at 1.25x input, reads at 0.1x.
const COST_PER_M_INPUT = 2.0
const COST_PER_M_OUTPUT = 10.0
const TOOL_NAME = 'record_visual_score'

export interface LabeledImage {
  // Shown to the model right before the image, e.g. "Laptop, top of page"
  label: string
  path: string
}

export interface VisualScoreInput {
  images: LabeledImage[]
  facts: string
}

export interface VisualScoreResult {
  score: VisualScore
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number; estimatedCostUsd: number }
}

export interface VisualScoreOptions {
  client?: Anthropic
  effort?: 'low' | 'medium' | 'high'
  // Adaptive thinking lets the model weigh rule exceptions before rating; off is cheaper and faster
  thinking?: 'off' | 'adaptive'
}

const SCREENSHOT_ORDER: readonly { viewport: 'desktop' | 'mobile' | 'small'; position: 'loaded' | 'top' | 'scrolled'; label: string }[] = [
  { viewport: 'desktop', position: 'loaded', label: 'Laptop, as loaded (before closing banners or popups)' },
  { viewport: 'desktop', position: 'top', label: 'Laptop, top of page' },
  { viewport: 'desktop', position: 'scrolled', label: 'Laptop, one screen down' },
  { viewport: 'mobile', position: 'loaded', label: 'Phone, as loaded (before closing banners or popups)' },
  { viewport: 'mobile', position: 'top', label: 'Phone, top of page' },
  { viewport: 'mobile', position: 'scrolled', label: 'Phone, one screen down' },
  { viewport: 'small', position: 'top', label: 'Small laptop (1366px), top of page' },
]

/**
 * Builds the scorer input from an inspection. The small-laptop screenshot is only sent when
 * something changes at that width, since it otherwise repeats the laptop view.
 */
export const visualScoreInputFromInspection = (inspection: SiteInspection): VisualScoreInput => {
  const images = SCREENSHOT_ORDER.flatMap(({ viewport, position, label }) => {
    if (viewport === 'small' && !inspection.smallLaptopIssues.length) return []
    const shot = inspection.views.find((v) => v.viewport === viewport)?.screenshots.find((s) => s.position === position)
    return shot ? [{ label, path: shot.path }] : []
  })
  return { images, facts: describeInspectionFacts(inspection) }
}

const nullable = (schema: Record<string, unknown>): Record<string, unknown> => ({ anyOf: [schema, { type: 'null' }] })

export const VISUAL_SCORE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: 'Record the visual design rating for the site in the screenshots.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['unassessable', 'overall', 'pitch', 'issues', 'findings', 'strengths', 'cantJudge', 'note'],
    properties: {
      unassessable: { type: 'boolean', description: 'True when the screenshots do not show the site (bot check, error, blank page)' },
      overall: nullable({ type: 'integer', enum: [1, 2, 3, 4, 5], description: 'Design rating on the 1-5 scale' }),
      pitch: nullable({ type: 'string', enum: [...PITCH_VALUES], description: 'Whether to pitch a redesign' }),
      issues: { type: 'array', items: { type: 'string', enum: [...VISUAL_ISSUES] } },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['ruleId', 'extent', 'count', 'where', 'evidence'],
          properties: {
            ruleId: { type: 'string', description: 'Id of the rule this breaks, or "other"' },
            extent: { type: 'string', enum: ['full', 'partial'], description: 'partial when the problem is only partly there' },
            count: nullable({ type: 'integer', description: 'Units for counted rules (header bars), otherwise null' }),
            where: { type: 'string', enum: ['laptop', 'phone', 'both', 'small laptop'] },
            evidence: { type: 'string', description: 'What the screenshot or measurement shows' },
          },
        },
      },
      strengths: { type: 'array', items: { type: 'string' } },
      cantJudge: { type: 'array', items: { type: 'string' } },
      note: { type: 'string', description: "One or two sentences in the designer's voice" },
    },
  },
}

const imageBlocks = async (images: LabeledImage[]): Promise<Anthropic.ContentBlockParam[]> => {
  const blocks = await Promise.all(
    images.map(async ({ label, path }): Promise<Anthropic.ContentBlockParam[]> => [
      { type: 'text', text: `${label}:` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await readFile(path)).toString('base64') } },
    ])
  )
  return blocks.flat()
}

/** Builds the Messages API request. Exposed so tests can check it without calling the API. */
export const buildVisualScoreRequest = async (
  { images, facts }: VisualScoreInput,
  { effort = 'medium', thinking = 'adaptive' }: Pick<VisualScoreOptions, 'effort' | 'thinking'> = {}
): Promise<Anthropic.MessageCreateParamsNonStreaming> => ({
  model: MODEL,
  max_tokens: 16000,
  // Unlike the extractor's classification calls, this is a judgment call: in the bench eval, low effort
  // with thinking off skipped rule exceptions. Thinking off stays available for cheap bulk runs.
  thinking: thinking === 'adaptive' ? { type: 'adaptive' } : { type: 'disabled' },
  output_config: { effort },
  system: [{ type: 'text', text: visualScoreSystemPrompt(), cache_control: { type: 'ephemeral' } }],
  tools: [VISUAL_SCORE_TOOL],
  tool_choice: { type: 'tool', name: TOOL_NAME },
  messages: [{ role: 'user', content: [...(await imageBlocks(images)), { type: 'text', text: visualScoreUserText(facts) }] }],
})

/**
 * Validates the tool input, keeps it consistent (no rating on an unassessable site) and computes the
 * 100-point score from the findings with the rubric's point values.
 */
export const parseVisualScore = (toolInput: unknown): VisualScore => {
  const output = visualScoreModelSchema.parse(toolInput)
  if (output.unassessable) return { ...output, overall: null, pitch: null, points: null, deductions: [], rubric: RUBRIC_VERSION }
  if (output.overall === null) throw new Error('visual score is missing a rating for an assessable site')
  const { score, deductions } = computeDesignPoints(output.findings)
  return { ...output, points: score, deductions, rubric: RUBRIC_VERSION }
}

/** Rates a site's visual design from screenshots and measured facts, using the rubric learned from hand ratings. */
export const scoreSiteVisually = async (input: VisualScoreInput, { client = new Anthropic(), effort, thinking }: VisualScoreOptions = {}): Promise<VisualScoreResult> => {
  if (!input.images.length) throw new Error('visual scoring needs at least one screenshot')
  const response = await client.messages.create(await buildVisualScoreRequest(input, { effort, thinking }))
  const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!block) throw new Error(`visual scorer returned no ${TOOL_NAME} call (stop reason: ${response.stop_reason ?? 'unknown'})`)

  const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = response.usage
  const cached = cache_read_input_tokens ?? 0
  const written = cache_creation_input_tokens ?? 0
  const estimatedCostUsd = ((input_tokens + written * 1.25 + cached * 0.1) / 1_000_000) * COST_PER_M_INPUT + (output_tokens / 1_000_000) * COST_PER_M_OUTPUT
  return {
    score: parseVisualScore(block.input),
    usage: { inputTokens: input_tokens + written + cached, cachedInputTokens: cached, outputTokens: output_tokens, estimatedCostUsd },
  }
}
