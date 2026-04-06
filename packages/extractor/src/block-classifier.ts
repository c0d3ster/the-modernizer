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
  const parsed = parseJsonResponse<unknown>(raw)
  const validated = classificationResponseSchema.parse(parsed)

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
