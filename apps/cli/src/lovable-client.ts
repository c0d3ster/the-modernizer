import { exec } from 'node:child_process'
import type { SiteSchema } from '@modernizer/schema'

const LOVABLE_BUILD_URL = 'https://lovable.dev/'

const openBrowser = (url: string): void => {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd)
}

const buildPrompt = (schema: SiteSchema): string => {
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

export const createLovableProject = async (schema: SiteSchema, verbose: boolean): Promise<string> => {
  const prompt = buildPrompt(schema)

  if (verbose) {
    process.stdout.write(`  Prompt length: ${prompt.length} chars (limit: 50,000)\n`)
  }

  if (prompt.length > 50_000) {
    throw new Error(`Prompt too long (${prompt.length} chars). Use --max-pages to crawl fewer pages.`)
  }

  const url = `${LOVABLE_BUILD_URL}?autosubmit=true#prompt=${encodeURIComponent(prompt)}`

  process.stdout.write(`\nOpening Lovable in your browser...\n`)
  process.stdout.write(`Log in if prompted — the project will build automatically.\n\n`)
  openBrowser(url)

  return 'Project creation started in browser — check Lovable for the live URL once it builds.'
}
