import type { ContentBlock, HeroBlock, SiteSchema, TextSectionBlock } from '@modernizer/schema'

// A hero's subheading is one or two lines under the headline. Old sites often put their whole
// welcome paragraph there (961 characters on one auto body shop), which pushes the call to action
// below the first screen. Whole sentences up to this length stay in the hero; the rest moves into
// a text section right after it, so nothing the business wrote is lost.
export const HERO_LEAD_MAX_CHARS = 180

const SENTENCE_END = /(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/

/** Whole sentences from the start that fit within `max` characters (empty if the first doesn't). */
export const splitLead = (text: string, max = HERO_LEAD_MAX_CHARS): { lead: string; rest: string } => {
  const trimmed = text.trim()
  if (trimmed.length <= max) return { lead: trimmed, rest: '' }
  const sentences = trimmed.split(SENTENCE_END)
  const kept: string[] = []
  for (const sentence of sentences) {
    const next = [...kept, sentence].join(' ')
    if (next.length > max) break
    kept.push(sentence)
  }
  return { lead: kept.join(' '), rest: sentences.slice(kept.length).join(' ').trim() }
}

const shortenHero = (block: HeroBlock): ContentBlock[] => {
  if (!block.subheading) return [block]
  const { lead, rest } = splitLead(block.subheading)
  if (!rest) return [block]
  const { subheading: _subheading, ...withoutSubheading } = block
  const hero: HeroBlock = lead ? { ...block, subheading: lead } : withoutSubheading
  const section: TextSectionBlock = { type: 'text_section', body: rest }
  return [hero, section]
}

/** Keeps every hero's subheading short, moving the overflow into a text section after the hero. */
export const shortenHeroLeads = (schema: SiteSchema): SiteSchema => ({
  ...schema,
  pages: schema.pages.map((page) => ({
    ...page,
    blocks: page.blocks.flatMap((block) => (block.type === 'hero' ? shortenHero(block) : [block])),
  })),
})
