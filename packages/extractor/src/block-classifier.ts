import { contentBlockSchema, pageArchetypeSchema } from '@modernizer/schema'
import type { ContentBlock, PageArchetype } from '@modernizer/schema'
import { z } from 'zod'

import { callLlm, parseJsonResponse } from './llm-client.js'
import { classifyBlocksPrompt } from './prompts/classify-blocks.js'
import type { RawBlock } from './block-splitter.js'

const classificationResponseSchema = z.object({
  archetype: pageArchetypeSchema,
  blocks: z.array(z.unknown()),
})

export interface ClassificationResult {
  archetype: PageArchetype
  blocks: ContentBlock[]
}

export const classifyBlocks = async (
  pageTitle: string,
  rawBlocks: RawBlock[]
): Promise<ClassificationResult> => {
  if (rawBlocks.length === 0) {
    return { archetype: 'generic' as PageArchetype, blocks: [] }
  }

  const prompt = classifyBlocksPrompt(pageTitle, rawBlocks)
  const raw = await callLlm(prompt)

  let parsed: unknown
  try {
    parsed = parseJsonResponse<unknown>(raw)
  } catch {
    console.warn(`  [warn] page "${pageTitle}": LLM returned invalid JSON, falling back to generic blocks`)
    console.warn('  raw response:', raw.slice(0, 300))
    return {
      archetype: 'generic' as PageArchetype,
      blocks: rawBlocks.map((b) => ({ type: 'generic_section' as const, rawHtml: b.html })),
    }
  }

  const result = classificationResponseSchema.safeParse(parsed)
  if (!result.success) {
    console.warn(`  [warn] page "${pageTitle}": LLM response failed schema validation, falling back to generic blocks`)
    return {
      archetype: 'generic' as PageArchetype,
      blocks: rawBlocks.map((b) => ({ type: 'generic_section' as const, rawHtml: b.html })),
    }
  }
  const validated = result.data

  const blocks: ContentBlock[] = validated.blocks.map((rawBlock, index) => {
    const result = contentBlockSchema.safeParse(rawBlock)
    if (result.success) return result.data

    // fallback: preserve raw HTML of the corresponding input block
    const fallbackHtml = rawBlocks[index]?.html ?? ''
    return {
      type: 'generic_section' as const,
      rawHtml: fallbackHtml,
    }
  })

  return { archetype: validated.archetype, blocks }
}
