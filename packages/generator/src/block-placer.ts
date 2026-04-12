import type { SiteSchema, SiteFooterInfo, ContentBlock } from '@modernizer/schema'
import type { ContactInfoBlock } from '@modernizer/schema'
import { PageArchetype } from '@modernizer/schema'

export interface PlacementDecision {
  type:
    | 'contact_promoted_to_footer'
    | 'contact_suppressed_duplicate'
    | 'contact_kept_inline'
  pageTitle: string
  pageUrl: string
  detail: string
}

export interface PlacementResult {
  schema: SiteSchema
  decisions: PlacementDecision[]
}

const mergeContactIntoFooter = (
  footer: SiteFooterInfo,
  block: ContactInfoBlock,
): { footer: SiteFooterInfo; promoted: boolean } => {
  let changed = false
  const updated = { ...footer }
  if (!updated.phone && block.phone) { updated.phone = block.phone; changed = true }
  if (!updated.email && block.email) { updated.email = block.email; changed = true }
  if (!updated.address && block.address) { updated.address = block.address; changed = true }
  return { footer: updated, promoted: changed }
}

const placeBlock = (
  block: ContentBlock,
  pageTitle: string,
  pageUrl: string,
  archetype: PageArchetype,
  footer: SiteFooterInfo,
  decisions: PlacementDecision[],
): { keep: boolean; footer: SiteFooterInfo } => {
  if (block.type !== 'contact_info') return { keep: true, footer }

  if (archetype === PageArchetype.Contact) {
    decisions.push({
      type: 'contact_kept_inline',
      pageTitle,
      pageUrl,
      detail: `Contact info kept inline on dedicated Contact page`,
    })
    return { keep: true, footer }
  }

  const { footer: updatedFooter, promoted } = mergeContactIntoFooter(footer, block)

  if (promoted) {
    decisions.push({
      type: 'contact_promoted_to_footer',
      pageTitle,
      pageUrl,
      detail: `Contact info promoted to global footer from "${pageTitle}" — phone/email/address merged`,
    })
  } else {
    decisions.push({
      type: 'contact_suppressed_duplicate',
      pageTitle,
      pageUrl,
      detail: `Duplicate contact info removed from "${pageTitle}" — footer already has this data`,
    })
  }

  return { keep: false, footer: updatedFooter }
}

/** Applies intelligent block placement rules to a SiteSchema before code generation. */
export const placeBlocks = (schema: SiteSchema): PlacementResult => {
  const decisions: PlacementDecision[] = []
  let footer: SiteFooterInfo = schema.footer ?? {}

  const pages = schema.pages.map((page) => {
    const kept: ContentBlock[] = []

    for (const block of page.blocks) {
      const result = placeBlock(block, page.title, page.url, page.archetype, footer, decisions)
      footer = result.footer
      if (result.keep) kept.push(block)
    }

    return { ...page, blocks: kept }
  })

  const updatedFooter = Object.keys(footer).length > 0 ? footer : schema.footer

  return {
    schema: { ...schema, pages, footer: updatedFooter },
    decisions,
  }
}
