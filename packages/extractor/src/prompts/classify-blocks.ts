import type { LlmTool } from '../llm-client.js'
import type { RawBlock } from '../block-splitter.js'

/** Per-block HTML cap keeps prompts within model context. */
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
- generic_section: { heading?: string }

RULES:
- Each input block's HTML may be truncated for length limits. Preserve all visible text exactly — do not summarize, rewrite, omit, or invent text.
- Use generic_section as a fallback when no other type fits.
- For body fields in text_section, preserve the full text content as a plain string (no HTML tags).
- Each output block MUST include the "index" field from its corresponding input block.
- Do NOT include a "rawHtml" field — the original HTML is already stored and will be injected automatically.
- Return exactly ${blocks.length} blocks, one per input block. Do not drop, merge, or reorder.

Also classify the page archetype from this list:
home | about | services | contact | blog | blog_post | team | pricing | faq | gallery | generic

INPUT BLOCKS (${blocks.length} total):
${JSON.stringify(blocks.map((b, i) => ({ index: i, html: b.html.slice(0, MAX_BLOCK_HTML_CHARS) })), null, 2)}

EXAMPLES:
Block with a large headline and a button → hero
Block with "What Our Clients Say" heading and quotes → testimonial
Block with a heading and paragraphs of prose → text_section
Block with "Call us at 555-1234" or an address → contact_info
`.trim()

export const classifyBlocksTool: LlmTool = {
  name: 'classify_blocks',
  description: 'Classify HTML content blocks into typed schema blocks and detect the page archetype.',
  input_schema: {
    type: 'object',
    required: ['archetype', 'blocks'],
    properties: {
      archetype: {
        type: 'string',
        enum: ['home', 'about', 'services', 'contact', 'blog', 'blog_post', 'team', 'pricing', 'faq', 'gallery', 'generic'],
      },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['index', 'type'],
          properties: {
            index: { type: 'number', description: 'The index of the corresponding input block.' },
            type: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
  },
}
