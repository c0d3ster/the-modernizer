import type { ContentBlock, PageSchema, SiteSchema } from '@modernizer/schema'
import type { PromptParts } from '../llm-client.js'
import { routePathToFilePath, urlToRoutePath } from '../route-utils.js'
import { buildSiteContextBlock } from './shared.js'

const serializeBlock = (block: ContentBlock): string => {
  if (block.type === 'generic_section') {
    const truncated = block.rawHtml.length > 600
      ? block.rawHtml.substring(0, 600) + '...[truncated]'
      : block.rawHtml
    return JSON.stringify({ ...block, rawHtml: truncated })
  }
  if (block.type === 'embed') {
    return JSON.stringify({ ...block, embedHtml: block.embedHtml.substring(0, 300) + '...' })
  }
  return JSON.stringify(block)
}

/**
 * Builds the prompt for a single page.tsx. The shell (layout/navbar/footer) is generated
 * separately. `designSystemSpec` is the shell call's hand-off of the spacing/card/heading/button
 * conventions it already decided on (see design-system.ts) — pass the same string for every page
 * in a run so the cached block stays identical across all of them.
 */
export const buildPagePrompt = (schema: SiteSchema, page: PageSchema, designSystemSpec: string): PromptParts => {
  const { rootUrl } = schema
  const filePath = routePathToFilePath(urlToRoutePath(page.url, rootUrl))
  const blocks = page.blocks.map((b) => `  ${serializeBlock(b)}`).join('\n')

  return {
    cached: buildSiteContextBlock(schema, designSystemSpec),
    task: `You are building a single page for this site.

## Page
- Title: ${page.title}
- Archetype: ${page.archetype}
- File: ${filePath}

## Content Blocks
${blocks}

## Additional Notes
- The root layout (src/app/layout.tsx) already renders the Navbar and Footer around every page — do NOT render or import Navbar/Footer here, and do NOT import './globals.css' here
- If a \`hero\` block has a \`backgroundImageUrl\`, render it as a full-bleed background via \`next/image\` (\`fill\` + \`object-cover\`), not just a color

## Required File
Generate exactly one file: ${filePath} — the default-exported page component for this route. Do NOT use Next.js dynamic route syntax like [slug] or [...slug].

## Quality Bar
- Follow the Design System section above exactly — same container/padding, section spacing, card style, heading scale, button conventions, and hero treatment as every other page. Do not invent your own variant of any of these; this page must look like it was built by the same person as the rest of the site
- Use the brand colors meaningfully throughout — hero backgrounds, buttons, accents
- Real content from the blocks above — no placeholders, no Lorem Ipsum
- Semantic HTML, accessible (aria labels, alt text)
- Generous whitespace, strong visual hierarchy

Call write_files with this one file.`,
  }
}
