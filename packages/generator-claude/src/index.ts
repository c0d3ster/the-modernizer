import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { SiteSchema, ContentBlock } from '@modernizer/schema'
import {
  generatePackageJson,
  generateNextConfig,
  generateTsConfig,
  generatePostcss,
  collectImageHostnames,
} from '@modernizer/generator-config'

const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 64_000
const MAX_ATTEMPTS = 3

const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

const WriteFilesInputSchema = z.object({
  files: z.array(GeneratedFileSchema),
})

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

const WAYBACK_URL_PATTERN = /^https?:\/\/web\.archive\.org\/web\/\d{1,14}[a-z_]*\/(https?:\/\/.+)$/i
const unwrapWaybackUrl = (url: string): string => url.match(WAYBACK_URL_PATTERN)?.[1] ?? url

const urlToRoutePath = (url: string, baseUrl: string): string => {
  const resolvedUrl = unwrapWaybackUrl(url)
  const resolvedBase = unwrapWaybackUrl(baseUrl)
  const { pathname } = new URL(resolvedUrl, resolvedBase)
  const clean = pathname.replace(/\/$/, '')
  return clean || '/'
}

const routePathToFilePath = (routePath: string): string =>
  routePath === '/' ? 'src/app/page.tsx' : `src/app${routePath}/page.tsx`

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
    const filePath = routePathToFilePath(urlToRoutePath(p.url, rootUrl))
    const blocks = p.blocks.map(b => `    ${serializeBlock(b)}`).join('\n')
    return `### ${p.title} (${p.archetype})\nFile: ${filePath}\nBlocks:\n${blocks}`
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

## Already Provided
package.json, next.config.ts, tsconfig.json, and postcss.config.mjs are generated separately and already correct — do NOT generate these files. Assume \`class-variance-authority\`, \`clsx\`, \`tailwind-merge\`, \`lucide-react\`, and the \`@radix-ui/*\` packages needed for inlined shadcn components (Slot, Accordion, Avatar, Separator) are already installed.

## Required Files
Generate ALL of the following:
- src/app/globals.css
- src/app/layout.tsx (Navbar + Footer)
- src/app/page.tsx (home)
- One page.tsx file for every page listed in the Pages section above, at the exact File: path given for that page. Do NOT use Next.js dynamic route syntax like [slug] or [...slug] anywhere — every page gets its own real static file at its own real path.
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

  let files: z.infer<typeof GeneratedFileSchema>[] | undefined
  let outputTokens = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !files; attempt++) {
      process.stdout.write(attempt === 1 ? '  Calling Claude API...\n' : '  Retrying after malformed response...\n')

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
      process.stdout.write(`  ...still generating (${streamedChars.toLocaleString()} chars streamed)\n`)
    }, 15_000)

    const response = await stream.finalMessage().finally(() => clearInterval(heartbeat))

    const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'write_files')
    if (!toolUse || toolUse.type !== 'tool_use') {
      if (attempt === MAX_ATTEMPTS) throw new Error('Claude did not return a write_files tool call')
      continue
    }

    const parsed = WriteFilesInputSchema.safeParse(toolUse.input)
    if (!parsed.success) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`Claude returned malformed files (stop_reason: ${response.stop_reason}): ${parsed.error.message}`)
      }
      continue
    }

    files = parsed.data.files
    outputTokens = response.usage.output_tokens

    if (verbose) {
      process.stdout.write(`  Writing ${files.length} files...\n`)
      process.stdout.write(`  Stop reason: ${response.stop_reason}, output tokens: ${outputTokens.toLocaleString()}\n`)
    }
  }

  if (!files) throw new Error('Claude failed to return valid files')

  const configPaths = new Set(['package.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs'])
  const configFiles: z.infer<typeof GeneratedFileSchema>[] = [
    { path: 'package.json', content: generatePackageJson(schema) },
    { path: 'next.config.ts', content: generateNextConfig(collectImageHostnames(schema)) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'postcss.config.mjs', content: generatePostcss() },
  ]
  const allFiles = [...configFiles, ...files.filter((f) => !configPaths.has(f.path))]

  await Promise.all(
    allFiles.map(async ({ path, content }) => {
      const fullPath = join(outDir, path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content)
    })
  )

  process.stdout.write(`  Wrote ${allFiles.length} files (${outputTokens.toLocaleString()} output tokens)\n`)
}
