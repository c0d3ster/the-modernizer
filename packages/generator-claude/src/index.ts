import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { SiteSchema, ContentBlock } from '@modernizer/schema'

const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 64_000

interface GeneratedFile {
  path: string
  content: string
}

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

export const buildClaudePrompt = (schema: SiteSchema): string => {
  const { siteName, rootUrl, brandColors, pages, nav, tagline, footer } = schema

  const colorInfo = [
    brandColors.primary && `primary: ${brandColors.primary}`,
    brandColors.secondary && `secondary: ${brandColors.secondary}`,
    brandColors.background && `background: ${brandColors.background}`,
    brandColors.text && `text foreground: ${brandColors.text}`,
  ].filter(Boolean).join(', ')

  const navStr = nav.map(n =>
    n.children?.length
      ? `${n.label} (${n.url}) > [${n.children.map(c => `${c.label}: ${c.url}`).join(', ')}]`
      : `${n.label}: ${n.url}`
  ).join('\n  ')

  const pagesStr = pages.map(p => {
    const blocks = p.blocks.map(b => `    ${serializeBlock(b)}`).join('\n')
    return `### ${p.title} (${p.archetype})\nURL: ${p.url}\nBlocks:\n${blocks}`
  }).join('\n\n')

  return `You are generating a complete, production-quality Next.js 15 website from a structured content schema.
Produce beautiful, polished UI — this should look as good as a professional agency designed it.

## Site
- Name: ${siteName}
- Original URL: ${rootUrl}
${tagline ? `- Tagline: ${tagline}` : ''}
- Brand colors: ${colorInfo || 'not specified — choose tastefully'}
${footer?.phone ? `- Phone: ${footer.phone}` : ''}
${footer?.email ? `- Email: ${footer.email}` : ''}
${footer?.address ? `- Address: ${footer.address}` : ''}

## Navigation
  ${navStr || 'none'}

## Pages
${pagesStr}

## Tech Stack
- Next.js 15 App Router, React 19, TypeScript strict mode
- Tailwind CSS v4 — use \`@import "tailwindcss"\` + \`@theme { }\` in globals.css (no tailwind.config.js)
- shadcn/ui (Button, Card, Badge, etc.) — inline the component source, do NOT import from a registry
- lucide-react for icons
- Mobile-first responsive design

## Required Files
Generate ALL of the following:
- package.json
- next.config.ts
- tsconfig.json
- postcss.config.mjs
- src/app/globals.css
- src/app/layout.tsx (Navbar + Footer)
- src/app/page.tsx (home)
- src/app/[slug]/page.tsx for every other page
- src/components/ui/button.tsx, badge.tsx, card.tsx (shadcn inline)
- src/components/layout/Navbar.tsx
- src/components/layout/Footer.tsx
- src/lib/utils.ts (cn helper)
- Any additional component files you need

## Quality Bar
- Use the brand colors meaningfully throughout — hero backgrounds, buttons, accents
- Real content from the schema — no placeholders, no Lorem Ipsum
- Semantic HTML, accessible (aria labels, alt text)
- Smooth hover states and transitions
- Generous whitespace, strong visual hierarchy
- The Navbar should be sticky/fixed with a subtle shadow on scroll

Call write_files with every file needed to run the site with \`npm install && npm run dev\`.`
}

export const generateWithClaude = async (schema: SiteSchema, outDir: string, verbose = false): Promise<void> => {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildClaudePrompt(schema)

  if (verbose) {
    process.stdout.write(`  Prompt: ${prompt.length.toLocaleString()} chars\n`)
    process.stdout.write(`  Model: ${MODEL}, max_tokens: ${MAX_TOKENS.toLocaleString()}\n`)
  }

  process.stdout.write('  Calling Claude API...\n')

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: 'You are an expert frontend engineer. Always call write_files with the complete generated file tree.',
    tools: [
      {
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
      },
    ],
    tool_choice: { type: 'tool', name: 'write_files' },
    messages: [{ role: 'user', content: prompt }],
  })

  let streamedChars = 0
  stream.on('inputJson', (partialJson) => {
    streamedChars += partialJson.length
  })

  const heartbeat = setInterval(() => {
    process.stdout.write(`  ...still generating (${streamedChars.toLocaleString()} chars streamed)
`)
  }, 5_000)

  const response = await stream.finalMessage().finally(() => clearInterval(heartbeat))

  const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'write_files')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return a write_files tool call')
  }

  const { files } = toolUse.input as { files: GeneratedFile[] }

  if (verbose) {
    process.stdout.write(`  Writing ${files.length} files...\n`)
    process.stdout.write(`  Stop reason: ${response.stop_reason}, output tokens: ${response.usage.output_tokens.toLocaleString()}\n`)
  }

  await Promise.all(
    files.map(async ({ path, content }) => {
      const fullPath = join(outDir, path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content)
    })
  )

  process.stdout.write(`  Wrote ${files.length} files (${response.usage.output_tokens.toLocaleString()} output tokens)\n`)
}
