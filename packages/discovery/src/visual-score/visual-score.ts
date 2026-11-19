import { readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { RUBRIC_VERSION, computeDesignPoints } from '@modernizer/design-guide'
import { PITCH_VALUES, VISUAL_ISSUES, visualScoreModelSchema } from '@modernizer/schema'
import type { FindingCheck, SiteInspection, VisualFinding, VisualScore } from '@modernizer/schema'

import { describeInspectionFacts } from './inspection-facts.js'
import { capHeaderBarFindings, summarizeHeaderBars } from './header-bars.js'
import { VERIFY_TOOL, VERIFY_TOOL_NAME, applyFindingChecks, findingsToCheck, parseFindingChecks, verifyFindingsText } from './verify-findings.js'
import { visualScoreSystemPrompt, visualScoreUserText } from './prompts/visual-score.js'

export const VISUAL_SCORE_MODELS = ['claude-sonnet-5', 'claude-opus-5-5'] as const
export type VisualScoreModel = (typeof VISUAL_SCORE_MODELS)[number]

interface ModelProfile {
  // List price, $ per million tokens (Nov 2026). Cache writes bill at 1.25x input, reads at 0.1x.
  input: number
  output: number
  // Opus 5.5 rejects a forced tool choice and disabled thinking, so it is asked for the tool instead
  forcedToolChoice: boolean
}

const MODEL_PROFILES: Readonly<Record<VisualScoreModel, ModelProfile>> = {
  'claude-sonnet-5': { input: 2.0, output: 10.0, forcedToolChoice: true },
  'claude-opus-5-5': { input: 4.0, output: 20.0, forcedToolChoice: false },
}
const TOOL_NAME = 'record_visual_score'

export interface LabeledImage {
  // Shown to the model right before the image, e.g. "Laptop, top of page"
  label: string
  path: string
}

export interface VisualScoreInput {
  images: LabeledImage[]
  facts: string
  // Bars beyond the main header, measured on the laptop view; caps the header-bars finding
  extraHeaderBars?: number | null
  // Whether the laptop header stays pinned after scrolling; a pinned header can't be charged as not sticky
  headerSticks?: boolean
}

export interface VisualScoreResult {
  score: VisualScore
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number; estimatedCostUsd: number }
}

export interface VisualScoreOptions {
  client?: Anthropic
  model?: VisualScoreModel
  effort?: 'low' | 'medium' | 'high'
  // Adaptive thinking lets the model weigh rule exceptions before rating; off is cheaper and faster
  thinking?: 'off' | 'adaptive'
  // Recheck each finding against its rule's exceptions in a follow-up turn (default on)
  verify?: boolean
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
  const bands = inspection.views.find((v) => v.viewport === 'desktop')?.features?.headerBands
  const extraHeaderBars = bands ? summarizeHeaderBars(bands)?.extra : undefined
  const headerSticks = inspection.views.find((v) => v.viewport === 'desktop')?.headerSticks
  return {
    images,
    facts: describeInspectionFacts(inspection),
    ...(extraHeaderBars !== undefined && { extraHeaderBars }),
    ...(headerSticks !== undefined && { headerSticks }),
  }
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
  { effort = 'medium', thinking = 'adaptive', model = 'claude-sonnet-5' }: Pick<VisualScoreOptions, 'effort' | 'thinking' | 'model'> = {}
): Promise<Anthropic.MessageCreateParamsNonStreaming> => ({
  model,
  max_tokens: 16000,
  // Unlike the extractor's classification calls, this is a judgment call: in the bench eval, low effort
  // with thinking off skipped rule exceptions. Thinking off stays available for cheap bulk runs.
  thinking: thinking === 'off' && MODEL_PROFILES[model].forcedToolChoice ? { type: 'disabled' } : { type: 'adaptive' },
  output_config: { effort },
  system: [{ type: 'text', text: visualScoreSystemPrompt(), cache_control: { type: 'ephemeral' } }],
  // Both tools on every call keep the cached prefix identical for the follow-up check
  tools: [VISUAL_SCORE_TOOL, VERIFY_TOOL],
  tool_choice: MODEL_PROFILES[model].forcedToolChoice ? { type: 'tool', name: TOOL_NAME } : { type: 'auto' },
  messages: [
    {
      role: 'user',
      // Breakpoint after the screenshots, so the follow-up check reads them from cache
      content: [...(await imageBlocks(images)), { type: 'text', text: visualScoreUserText(facts), cache_control: { type: 'ephemeral' } }],
    },
  ],
})

/** The follow-up request: the same conversation, answering the score call with a check of each finding. */
export const buildVerifyRequest = (
  first: Anthropic.MessageCreateParamsNonStreaming,
  response: Pick<Anthropic.Message, 'content'>,
  toolUseId: string,
  items: readonly { index: number; finding: VisualFinding }[],
  model: VisualScoreModel
): Anthropic.MessageCreateParamsNonStreaming => ({
  ...first,
  tool_choice: MODEL_PROFILES[model].forcedToolChoice ? { type: 'tool', name: VERIFY_TOOL_NAME } : { type: 'auto' },
  messages: [
    ...first.messages,
    { role: 'assistant', content: response.content },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: toolUseId, content: 'Recorded.' },
        { type: 'text', text: verifyFindingsText(items) },
      ],
    },
  ],
})

/**
 * Validates the tool input, keeps it consistent (no rating on an unassessable site) and computes the
 * 100-point score from the findings with the rubric's point values. Measured header bars cap that
 * finding, and checks from the follow-up look drop or soften findings before points are counted.
 */
export const parseVisualScore = (
  toolInput: unknown,
  { extraHeaderBars, headerSticks, checks }: Pick<VisualScoreInput, 'extraHeaderBars' | 'headerSticks'> & { checks?: readonly FindingCheck[] } = {}
): VisualScore => {
  const parsed = visualScoreModelSchema.parse(toolInput)
  const checked = checks ? applyFindingChecks(parsed.findings, checks) : parsed.findings
  const measured = capHeaderBarFindings(checked, extraHeaderBars).filter((f) => !(headerSticks === true && f.ruleId === 'header-not-sticky'))
  const output = { ...parsed, findings: measured }
  const record = checks ? { checks: checks.map((c) => ({ ...c, ruleId: parsed.findings[c.index]?.ruleId ?? 'unknown' })) } : {}
  if (output.unassessable) return { ...output, overall: null, pitch: null, points: null, deductions: [], rubric: RUBRIC_VERSION, ...record }
  if (output.overall === null) throw new Error('visual score is missing a rating for an assessable site')
  const { score, deductions } = computeDesignPoints(output.findings)
  return { ...output, points: score, deductions, rubric: RUBRIC_VERSION, ...record }
}

interface Usage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

const usageOf = ({ usage }: Anthropic.Message, model: VisualScoreModel): Usage => {
  const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = usage
  const cached = cache_read_input_tokens ?? 0
  const written = cache_creation_input_tokens ?? 0
  const price = MODEL_PROFILES[model]
  const estimatedCostUsd = ((input_tokens + written * 1.25 + cached * 0.1) / 1_000_000) * price.input + (output_tokens / 1_000_000) * price.output
  return { inputTokens: input_tokens + written + cached, cachedInputTokens: cached, outputTokens: output_tokens, estimatedCostUsd }
}

const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
})

const toolUse = (response: Anthropic.Message, name: string): Anthropic.ToolUseBlock | undefined =>
  response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name)

/**
 * Rates a site's visual design from screenshots and measured facts, using the rubric learned from hand
 * ratings. With verify on (the default), a follow-up turn rechecks findings whose rules carry written
 * exceptions; it reuses the cached screenshots, so it adds little cost.
 */
export const scoreSiteVisually = async (
  input: VisualScoreInput,
  { client = new Anthropic(), effort, thinking, model = 'claude-sonnet-5', verify = true }: VisualScoreOptions = {}
): Promise<VisualScoreResult> => {
  if (!input.images.length) throw new Error('visual scoring needs at least one screenshot')
  const request = await buildVisualScoreRequest(input, { effort, thinking, model })
  const response = await client.messages.create(request)
  const block = toolUse(response, TOOL_NAME)
  if (!block) throw new Error(`visual scorer returned no ${TOOL_NAME} call (stop reason: ${response.stop_reason ?? 'unknown'})`)
  const usage = usageOf(response, model)

  const first = visualScoreModelSchema.parse(block.input)
  const toCheck = findingsToCheck(first.findings)
  if (!verify || first.unassessable || toCheck.length === 0) return { score: parseVisualScore(block.input, input), usage }

  const followUp = await client.messages.create(buildVerifyRequest(request, response, block.id, toCheck, model))
  const checkBlock = toolUse(followUp, VERIFY_TOOL_NAME)
  // A failed check leaves the first findings standing rather than failing the whole score
  const checks = checkBlock ? parseFindingChecks(checkBlock.input) : undefined
  return { score: parseVisualScore(block.input, { ...input, ...(checks && { checks }) }), usage: addUsage(usage, usageOf(followUp, model)) }
}
