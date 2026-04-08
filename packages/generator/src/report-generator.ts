import type { SiteSchema } from '@modernizer/schema'
import { urlToRoutePath, urlToComponentName } from './route-mapper.js'

const blockTypeLabel: Record<string, string> = {
  hero: 'Hero banner',
  text_section: 'Text section',
  feature_grid: 'Feature grid',
  testimonial: 'Testimonials',
  stats: 'Stats bar',
  cta: 'Call to action',
  team_grid: 'Team grid',
  gallery: 'Image gallery',
  faq: 'FAQ accordion',
  pricing: 'Pricing table',
  contact_info: 'Contact info',
  logo_cloud: 'Logo cloud',
  timeline: 'Timeline',
  generic_section: 'Generic section (fallback)',
}

const countBlocks = (schema: SiteSchema): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const page of schema.pages) {
    for (const block of page.blocks) {
      counts[block.type] = (counts[block.type] ?? 0) + 1
    }
  }
  return counts
}

export const generateReport = (
  schema: SiteSchema,
  nav: Array<{ label: string; url: string }>
): string => {
  const { siteName, rootUrl, tagline, brandColors, pages } = schema
  const blockCounts = countBlocks(schema)
  const totalBlocks = Object.values(blockCounts).reduce((a, b) => a + b, 0)
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  const pageRows = pages
    .map((p) => {
      const route = urlToRoutePath(p.url)
      const component = urlToComponentName(p.url)
      const blockSummary = p.blocks.map((b) => blockTypeLabel[b.type] ?? b.type).join(', ')
      return `| ${p.title ?? p.url} | \`${route}\` | \`${component}\` | ${blockSummary} |`
    })
    .join('\n')

  const blockRows = Object.entries(blockCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `| ${blockTypeLabel[type] ?? type} | ${count} |`)
    .join('\n')

  const navList = nav.map((item) => `- [${item.label}](${item.url})`).join('\n')

  const primaryColor = brandColors.primary ?? '#2563eb'
  const bgColor = brandColors.background ?? '#ffffff'
  const textColor = brandColors.text ?? '#ffffff'

  return `# Modernization Report: ${siteName}

Generated: ${generatedAt}

## Source Site

- **URL**: ${rootUrl}
- **Site name**: ${siteName}${tagline ? `\n- **Tagline**: ${tagline}` : ''}
- **Pages crawled**: ${pages.length}
- **Total content blocks extracted**: ${totalBlocks}

## What Changed

The original site was a static or CMS-driven website likely served with outdated HTML, CSS, and
minimal interactivity. This report summarizes how its content was restructured and regenerated as a
modern, responsive Next.js 15 application using React, Tailwind CSS v4, and shadcn/ui components.

### From old site to new stack

| Before | After |
|--------|-------|
| Static HTML / WordPress / legacy CMS | Next.js 15 App Router |
| Unresponsive or poorly responsive layout | Tailwind CSS v4 utility-first responsive design |
| Mixed inline styles, legacy CSS | Design tokens in \`globals.css\` \`@theme {}\` block |
| No component architecture | shadcn/ui primitives + typed block components |
| Hard-coded content in markup | Structured content extracted to typed \`SiteSchema\` |
| No TypeScript | TypeScript strict mode throughout |

## Brand Identity

Colors extracted from the original site and applied as Tailwind CSS theme tokens:

| Token | Value |
|-------|-------|
| \`--color-primary\` | \`${primaryColor}\` |
| \`--color-primary-foreground\` | \`${textColor}\` |
| \`--color-background\` | \`${bgColor}\` |

## Navigation (${nav.length} item${nav.length !== 1 ? 's' : ''})

${navList}

## Pages Generated (${pages.length})

| Page | Route | Component | Blocks |
|------|-------|-----------|--------|
${pageRows}

## Block Components Used

Each content block type maps 1:1 to a React component in \`src/components/blocks/\`.

| Block type | Count |
|------------|-------|
${blockRows}

## Output Structure

\`\`\`
src/
  app/
    globals.css          # Tailwind v4 theme tokens + base styles
    layout.tsx           # Root layout: Navbar + Footer
    page.tsx             # Home page
    <route>/
      page.tsx           # One file per crawled page
  components/
    shadcn/              # shadcn/ui primitives (Button, Card, Badge, ...)
    blocks/              # Content block components (HeroBlock, FAQBlock, ...)
    layout/              # Navbar, Footer
  lib/
    cn.ts                # clsx + tailwind-merge utility
  types/
    schema/              # Typed content schema (copied from @modernizer/schema)
\`\`\`

## Next Steps

1. \`cd\` into the output directory and run \`npm install\`
2. Run \`npm run dev\` to preview the site locally
3. Add real images to \`public/\` and update \`backgroundImageUrl\` references
4. Review and adjust the navigation structure if needed
5. Deploy to Vercel or any Next.js-compatible host
`
}
