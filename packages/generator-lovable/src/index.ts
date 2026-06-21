import { exec } from 'node:child_process'
import type { SiteSchema } from '@modernizer/schema'

const LOVABLE_BUILD_URL = 'https://lovable.dev/'
const PROMPT_LIMIT = 50_000

const openBrowser = (url: string): void => {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd)
}

export const buildLovablePrompt = (schema: SiteSchema): string => {
  const { siteName, rootUrl, brandColors, pages, nav } = schema

  const navItems = nav.map(n => n.label).join(', ')
  const colorInfo = [
    brandColors.primary && `primary: ${brandColors.primary}`,
    brandColors.secondary && `secondary: ${brandColors.secondary}`,
  ].filter(Boolean).join(', ')

  const pageDescriptions = pages.map(p => {
    const blockSummary = p.blocks
      .map(b => `    - ${b.type}${('heading' in b && b.heading) ? `: "${b.heading}"` : ''}`)
      .join('\n')
    return `  ${p.title} (${p.archetype}):\n${blockSummary}`
  }).join('\n\n')

  return `Recreate this website as a modern, responsive React + Tailwind CSS app.

Site: ${siteName}
Original URL: ${rootUrl}
Brand colors: ${colorInfo || 'not specified'}
Navigation: ${navItems}

Pages:
${pageDescriptions}

Requirements:
- Preserve all content, copy, and site structure exactly
- Use the brand colors throughout
- Clean, modern design system with consistent spacing and typography
- Fully responsive for mobile and desktop
- shadcn/ui components where appropriate`
}

export const generateLovable = (schema: SiteSchema, verbose = false): void => {
  const prompt = buildLovablePrompt(schema)

  if (verbose) {
    process.stdout.write(`  Prompt length: ${prompt.length} chars (limit: ${PROMPT_LIMIT.toLocaleString()})\n`)
  }

  if (prompt.length > PROMPT_LIMIT) {
    throw new Error(`Prompt too long (${prompt.length} chars). Use --max-pages to crawl fewer pages.`)
  }

  const url = `${LOVABLE_BUILD_URL}?autosubmit=true#prompt=${encodeURIComponent(prompt)}`

  process.stdout.write(`\nOpening Lovable in your browser...\n`)
  process.stdout.write(`Log in if prompted — the project will build automatically.\n\n`)
  openBrowser(url)
}
