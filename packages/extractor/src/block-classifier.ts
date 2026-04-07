import { contentBlockSchema, pageArchetypeSchema } from '@modernizer/schema'
import type { ContentBlock, PageArchetype } from '@modernizer/schema'
import { z } from 'zod'

import { callLlmWithTool } from './llm-client.js'
import { classifyBlocksPrompt, classifyBlocksTool } from './prompts/classify-blocks.js'
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
  const toolResult = await callLlmWithTool<unknown>(prompt, classifyBlocksTool)

  const result = classificationResponseSchema.safeParse(toolResult)
  if (!result.success) {
    console.warn(`  [warn] page "${pageTitle}": tool response failed schema validation, falling back to generic blocks`)
return {
      archetype: 'generic' as PageArchetype,
      blocks: rawBlocks.map((b) => ({ type: 'generic_section' as const, rawHtml: b.html })),
    }
  }
  const validated = result.data

  if (validated.blocks.length !== rawBlocks.length) {
    console.warn(
      `  [warn] page "${pageTitle}": expected ${rawBlocks.length} blocks, got ${validated.blocks.length}; falling back to generic blocks`
    )
    return {
      archetype: 'generic' as PageArchetype,
      blocks: rawBlocks.map((b) => ({ type: 'generic_section' as const, rawHtml: b.html })),
    }
  }

  const blocks: ContentBlock[] = validated.blocks.map((rawBlock, fallbackIndex) => {
    const b = rawBlock as { index?: number; type?: string; [key: string]: unknown }
    const sourceHtml = rawBlocks[b.index ?? fallbackIndex]?.html ?? ''

    // inject rawHtml for generic_section — model is not asked to echo it back
    const blockData = b.type === 'generic_section'
      ? { ...b, rawHtml: sourceHtml }
      : b

    const blockResult = contentBlockSchema.safeParse(blockData)
    if (blockResult.success) return blockResult.data

    return { type: 'generic_section' as const, rawHtml: sourceHtml }
  })

  return { archetype: validated.archetype, blocks }
}
