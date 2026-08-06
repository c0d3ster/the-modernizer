import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-5'

// claude-sonnet-5 standard Sonnet-tier rate: $3/$15 per MTok (discounted to $2/$10 through 2026-08-31 —
// not reflected here since these constants should stay accurate after the intro window closes).
const COST_PER_M_INPUT = 3.0
const COST_PER_M_OUTPUT = 15.0

let client: Anthropic | null = null

const getClient = (): Anthropic => {
  if (!client) client = new Anthropic()
  return client
}

export interface UsageStats {
  calls: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

const usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }

export const getUsageStats = (): UsageStats => ({ ...usage })

export const resetUsageStats = (): void => {
  usage.calls = 0
  usage.inputTokens = 0
  usage.outputTokens = 0
  usage.estimatedCostUsd = 0
}


export interface LlmTool {
  name: string
  description: string
  input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[]; [key: string]: unknown }
}

export const callLlmWithTool = async <T>(prompt: string, tool: LlmTool): Promise<T> => {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 8192,
    // claude-sonnet-5 rejects non-default sampling params (temperature: 0 among them) — the old
    // determinism intent is approximated instead with low effort + thinking off, which also keeps
    // this classification call's cost/latency profile close to what it was before the migration.
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('LLM did not return a tool_use block')
  }

  const { input_tokens, output_tokens } = response.usage
  usage.calls += 1
  usage.inputTokens += input_tokens
  usage.outputTokens += output_tokens
  usage.estimatedCostUsd +=
    (input_tokens / 1_000_000) * COST_PER_M_INPUT +
    (output_tokens / 1_000_000) * COST_PER_M_OUTPUT

  return block.input as T
}
