import type { RawBlock } from '../block-splitter.js'

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
- Preserve all text content exactly — do not summarize, rewrite, or omit any text.
- Use generic_section as a fallback when no other type fits.
- For body fields in text_section, preserve the full text content as a plain string (no HTML tags).
- Output ONLY valid JSON — no markdown fences, no preamble, no explanation.

Also classify the page archetype from this list:
home | about | services | contact | blog | blog_post | team | pricing | faq | gallery | generic

INPUT BLOCKS (${blocks.length} total):
${JSON.stringify(blocks.map((b, i) => ({ index: i, html: b.html })), null, 2)}

OUTPUT FORMAT (JSON only):
{
  "archetype": "<archetype>",
  "blocks": [
    { "type": "<block_type>", ...fields },
    ...
  ]
}

EXAMPLES:
Block with a large headline and a button → hero
Block with "What Our Clients Say" heading and quotes → testimonial
Block with a heading and paragraphs of prose → text_section
Block with "Call us at 555-1234" or an address → contact_info
`.trim()
