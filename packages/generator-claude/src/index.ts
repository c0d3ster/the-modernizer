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
  generateGlobalsCss,
  collectImageHostnames,
} from '@modernizer/generator-config'
import { copyDeterministicComponents } from './component-copier.js'

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
- shadcn/ui (Button, Card, Badge, Accordion, Avatar, Separator) — already provided, see below
- lucide-react for icons — only import icon names that actually exist in the package. Do not guess at plausible-sounding names (there is no \`Fax\`, for example — use \`Printer\` or \`Phone\` instead). If unsure whether an icon exists, use a common one you're confident about (Phone, Mail, MapPin, Clock, Check, X, Menu, ChevronDown, ArrowRight, Star, Users, Calendar, Facebook, Twitter, Instagram, Linkedin).
- Mobile-first responsive design

## Already Provided
These files are generated deterministically and already correct — do NOT generate them, and do NOT redefine the components they export:
- package.json, next.config.ts, tsconfig.json, postcss.config.mjs
- src/app/globals.css — defines the full shadcn CSS variable theme (\`--color-primary\`, \`--color-card\`, \`--color-border\`, etc.) mapped from the site's brand colors, plus \`@layer base\` rules. Use Tailwind classes like \`bg-primary\`, \`text-primary-foreground\`, \`bg-card\`, \`border\`, \`bg-muted\`, \`text-muted-foreground\`, \`bg-accent\` throughout for consistent theming — do not invent your own color variables or write a competing global CSS reset.
- src/lib/utils.ts (cn helper)
- src/components/ui/button.tsx, badge.tsx, card.tsx, accordion.tsx, avatar.tsx, separator.tsx (shadcn primitives, with \`asChild\`/Slot support where applicable) — import them from \`@/components/ui/<name>\`, do not redeclare them
Assume \`class-variance-authority\`, \`clsx\`, \`tailwind-merge\`, \`lucide-react\`, and the \`@radix-ui/*\` packages are already installed.

## Required Files
Generate ALL of the following:
- src/app/layout.tsx (Navbar + Footer)
- src/app/page.tsx (home)
- One page.tsx file for every page listed in the Pages section above, at the exact File: path given for that page. Do NOT use Next.js dynamic route syntax like [slug] or [...slug] anywhere — every page gets its own real static file at its own real path.
- src/components/layout/Navbar.tsx
- src/components/layout/Footer.tsx
- Any additional component files you need (composing the provided shadcn primitives above)

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

  const deterministicComponents = await copyDeterministicComponents()
  const deterministicFiles: z.infer<typeof GeneratedFileSchema>[] = [
    { path: 'package.json', content: generatePackageJson(schema) },
    { path: 'next.config.ts', content: generateNextConfig(collectImageHostnames(schema)) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'postcss.config.mjs', content: generatePostcss() },
    { path: 'src/app/globals.css', content: generateGlobalsCss(schema.brandColors) },
    ...deterministicComponents,
  ]
  const deterministicPaths = new Set(deterministicFiles.map((f) => f.path))
  const allFiles = [...deterministicFiles, ...files.filter((f) => !deterministicPaths.has(f.path))]

  await Promise.all(
    allFiles.map(async ({ path, content }) => {
      const fullPath = join(outDir, path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content)
    })
  )

  process.stdout.write(`  Wrote ${allFiles.length} files (${outputTokens.toLocaleString()} output tokens)\n`)
}
