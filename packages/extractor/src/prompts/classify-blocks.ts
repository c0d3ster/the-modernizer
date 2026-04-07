import type { RawBlock } from '../block-splitter.js'

/** Per-block HTML cap keeps prompts within model context; aligns with prompt rules below. */
const MAX_BLOCK_HTML_CHARS = 12_000

export const classifyBlocksPrompt = (pageTitle: string, blocks: RawBlock[]): string => `
You are extracting structured content from a web page for a site modernization tool.

Page title: ${pageTitle}

You will receive an array of HTML content blocks from this page. For each block, classify it into one of the following types and extract the structured fields.

BLOCK TYPES AND THEIR REQUIRED FIELDS:
- hero: { heading: string, subheading?: string, ctaText?: string, ctaUrl?: string, backgroundImageUrl?: string }
- text_section: { heading?: string, body: string }
- feature_grid: { heading?: string, features: [{ title, description, iconUrl? }] }
- testimonial: { heading?: string, testimonials: [{ quote, author, role?, avatarUrl? }] }
- team_grid: { heading?: string, members: [{ name, role?, bio?, photoUrl? }] }
- cta: { heading: string, subheading?: string, ctaText: string, ctaUrl: string }
- contact_info: { heading?: string, phone?, email?, address?, mapEmbedUrl? }
- faq: { heading?: string, items: [{ question, answer }] }
- stats: { heading?: string, stats: [{ value, label }] }
- image_gallery: { heading?: string, images: [{ url, alt?, caption? }] }
- pricing_table: { heading?: string, tiers: [{ name, price, description?, features: string[], ctaText?, ctaUrl? }] }
- logo_cloud: { heading?: string, logos: [{ name, imageUrl, url? }] }
- embed: { heading?: string, embedHtml: string }
- generic_section: { heading?: string, rawHtml: string }

RULES:
- Each input block's HTML may be truncated for length limits. Preserve all text that appears in that block's input exactly — do not summarize, rewrite, omit visible text, or invent text that was not in the input.
- Use generic_section as a fallback when no other type fits.
- For body fields in text_section, preserve the full text content as a plain string (no HTML tags).
- Output ONLY valid JSON — no markdown fences, no preamble, no explanation.
- The "blocks" array MUST contain exactly ${blocks.length} entries, in the same order as the input (index 0 → first output block, etc.). Do not drop, merge, or reorder blocks.

Also classify the page archetype from this list:
home | about | services | contact | blog | blog_post | team | pricing | faq | gallery | generic

INPUT BLOCKS (${blocks.length} total):
${JSON.stringify(blocks.map((b, i) => ({ index: i, html: b.html.slice(0, MAX_BLOCK_HTML_CHARS) })), null, 2)}

OUTPUT FORMAT (JSON only):
{
  "archetype": "<archetype>",
  "blocks": [
    { "type": "<block_type>", ...fields }
  ]
}
(Exactly ${blocks.length} objects in "blocks", order preserved.)

EXAMPLES:
Block with a large headline and a button → hero
Block with "What Our Clients Say" heading and quotes → testimonial
Block with a heading and paragraphs of prose → text_section
Block with "Call us at 555-1234" or an address → contact_info
`.trim()
