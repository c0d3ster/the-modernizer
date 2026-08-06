import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 16_000
const MAX_ATTEMPTS = 3
const HEARTBEAT_MS = 30_000

// claude-sonnet-4-5 pricing per Anthropic's standard Sonnet-tier rate (same as Sonnet 4.6): $3/$15 per MTok.
// Cache write/read multipliers are the standard 1.25x / 0.1x of the input rate (5-minute ephemeral TTL).
const INPUT_PRICE_PER_MTOK = 3.0
const OUTPUT_PRICE_PER_MTOK = 15.0
const CACHE_WRITE_PRICE_PER_MTOK = INPUT_PRICE_PER_MTOK * 1.25
const CACHE_READ_PRICE_PER_MTOK = INPUT_PRICE_PER_MTOK * 0.1

export interface UsageTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

const usage: UsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }

export const getUsageTotals = (): UsageTotals => ({ ...usage })

export const resetUsageTotals = (): void => {
  usage.calls = 0
  usage.inputTokens = 0
  usage.outputTokens = 0
  usage.cacheCreationTokens = 0
  usage.cacheReadTokens = 0
}

export const costForUsage = (u: UsageTotals): number =>
  (u.inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK +
  (u.outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK +
  (u.cacheCreationTokens / 1_000_000) * CACHE_WRITE_PRICE_PER_MTOK +
  (u.cacheReadTokens / 1_000_000) * CACHE_READ_PRICE_PER_MTOK

const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

const WriteFilesInputSchema = z.object({
  files: z.array(GeneratedFileSchema),
})

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>

const WRITE_FILES_TOOL = {
  name: 'write_files',
  description: 'Write all generated project files to disk',
  input_schema: {
    type: 'object' as const,
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root (e.g. src/app/page.tsx)' },
            content: { type: 'string', description: 'Full file content' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['files'],
  },
}

let client: Anthropic | null = null

const getClient = (): Anthropic => {
  if (!client) {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.')
    client = new Anthropic({ apiKey })
  }
  return client
}

const SYSTEM_PROMPT =
  'You are an expert frontend engineer building a production-quality Next.js 15 + Tailwind CSS + shadcn/ui website. Produce beautiful, polished UI — as good as a professional agency designed it. Always call write_files with the complete generated file tree.'

/**
 * `cached` must be byte-identical across every call in a generation run (the shell call and
 * every page call share the same site-context block) so it can be marked with cache_control —
 * only the first call pays full input-token price for it, the rest read it from cache at ~10%.
 * `task` is the call-specific instructions and is never cached.
 */
export interface PromptParts {
  cached: string
  task: string
}

/** Calls Claude with the write_files tool forced, validates the response, and retries on malformed output. */
export const callClaudeForFiles = async (prompt: PromptParts, label: string, verbose = false): Promise<GeneratedFile[]> => {
  let files: GeneratedFile[] | undefined

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !files; attempt++) {
    if (verbose) {
      process.stdout.write(attempt === 1 ? `  [${label}] calling Claude...\n` : `  [${label}] retrying after malformed response...\n`)
    }

    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [WRITE_FILES_TOOL],
      tool_choice: { type: 'tool', name: 'write_files' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.cached, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: prompt.task },
          ],
        },
      ],
    })

    let streamedChars = 0
    stream.on('inputJson', (partialJson) => {
      streamedChars += partialJson.length
    })

    const attemptStartTime = Date.now()
    const heartbeat = verbose
      ? setInterval(() => {
          const elapsedSeconds = Math.round((Date.now() - attemptStartTime) / 1000)
          process.stdout.write(
            `  [${label}] ...still generating (${elapsedSeconds} seconds elapsed, ${streamedChars.toLocaleString()} chars streamed)\n`
          )
        }, HEARTBEAT_MS)
      : undefined

    const response = await stream.finalMessage().finally(() => {
      if (heartbeat) clearInterval(heartbeat)
    })

    // Accumulate across every attempt — a retried (malformed/missing tool_use) attempt still
    // consumed real tokens and should count toward the true total cost of this generation.
    usage.calls += 1
    usage.inputTokens += response.usage.input_tokens
    usage.outputTokens += response.usage.output_tokens
    usage.cacheCreationTokens += response.usage.cache_creation_input_tokens ?? 0
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0

    const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'write_files')
    if (!toolUse || toolUse.type !== 'tool_use') {
      if (attempt === MAX_ATTEMPTS) throw new Error(`[${label}] Claude did not return a write_files tool call`)
      continue
    }

    const parsed = WriteFilesInputSchema.safeParse(toolUse.input)
    if (!parsed.success) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`[${label}] Claude returned malformed files (stop_reason: ${response.stop_reason}): ${parsed.error.message}`)
      }
      continue
    }

    files = parsed.data.files

    if (verbose) {
      process.stdout.write(`  [${label}] wrote ${files.length} file(s), ${response.usage.output_tokens.toLocaleString()} output tokens\n`)
    }
  }

  if (!files) throw new Error(`[${label}] Claude failed to return valid files`)
  return files
}
