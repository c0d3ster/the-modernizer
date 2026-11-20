import { COMPOSITE_WEIGHTS, PITCH_THRESHOLD } from '@modernizer/schema'
import type { CandidateScore, CompositeSignal, SiteSchema } from '@modernizer/schema'
import { urlToRoutePath, urlToComponentName } from './route-mapper.js'

const mdTableCell = (s: string): string => s.replace(/\|/g, '\\|')

const hasFooterContent = (footer: SiteSchema['footer']): boolean =>
  Boolean(footer?.phone?.trim()) ||
  Boolean(footer?.email?.trim()) ||
  Boolean(footer?.address?.trim())

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

// Cutoff per docs/market-discovery.md "Final score formula"
const scoreVerdict = (score: number): string =>
  score < PITCH_THRESHOLD
    ? `Pitch candidate: below the pitch threshold of ${PITCH_THRESHOLD}`
    : `Above the pitch threshold of ${PITCH_THRESHOLD}: already fairly modern, a harder pitch`

const formatScore = (score: number | null): string => (score === null ? 'n/a' : `${score}`)

const yesNo = (fired: boolean): string => (fired ? 'Yes' : 'No')

const yesNoOrNa = (fired: boolean | null): string => (fired === null ? 'n/a' : yesNo(fired))

const weight = (signal: CompositeSignal): string => `${Math.round(COMPOSITE_WEIGHTS[signal] * 100)}%`

// The composite's inputs, in docs/market-discovery.md order
const compositeRows = (candidate: CandidateScore): Array<{ label: string; value: number | null; signal: CompositeSignal }> => [
  { label: 'Visual design (screenshots)', value: candidate.visual_points, signal: 'visual' },
  { label: 'Static HTML', value: candidate.static_v2_score, signal: 'static' },
  { label: 'Build quality (Lighthouse audits)', value: candidate.psi_code, signal: 'code' },
  { label: 'SEO (Lighthouse)', value: candidate.psi_seo, signal: 'seo' },
  { label: 'Accessibility (Lighthouse)', value: candidate.psi_accessibility, signal: 'accessibility' },
  { label: 'Best Practices (Lighthouse)', value: candidate.psi_best_practices, signal: 'bestPractices' },
]

// Signal descriptions per docs/market-discovery.md "Sub-score 1: Static HTML".
const staticSignalRows = (candidate: CandidateScore): string[] => [
  `| No HTTPS / expired SSL | ${yesNo(candidate.no_ssl)} |`,
  `| No viewport meta tag (not mobile-ready) | ${yesNo(candidate.no_viewport)} |`,
  `| Old jQuery (1.x / 2.x) | ${yesNo(candidate.old_jquery)} |`,
  `| Old default WordPress theme | ${yesNo(candidate.old_wp_theme)} |`,
  `| Table-based layout | ${yesNo(candidate.table_layout)} |`,
  `| No Open Graph tags | ${yesNo(candidate.no_og_tags)} |`,
  `| IE compatibility meta tag | ${yesNo(candidate.ie_compatible)} |`,
  `| Years since the copyright year | ${formatScore(candidate.copyright_years_behind)} |`,
  `| No responsive images (srcset) | ${yesNoOrNa(candidate.no_srcset)} |`,
  `| Inline style attributes | ${formatScore(candidate.inline_styles)} |`,
]

const renderScoreSection = (candidate: CandidateScore): string => {
  const rows = compositeRows(candidate)
  const subScoreRows = rows.map(({ label, value, signal }) => `| ${label} | ${formatScore(value)} | ${weight(signal)} |`).join('\n')
  const missingNote = rows.some(({ value }) => value === null)
    ? '\nSignals shown as n/a were unavailable for this site, so the others were reweighted to fill their share.\n'
    : ''
  // Kept as talking points; neither counts toward the score
  const informational = [
    candidate.psi_performance !== null && `Lighthouse performance (mobile) ${formatScore(candidate.psi_performance)}`,
    `legacy static HTML score ${formatScore(candidate.static_score)}`,
  ].filter(Boolean)

  const staleness = candidate.last_changed
    ? `Content last changed **${candidate.last_changed}** (Wayback Machine).`
    : 'No Wayback Machine history for this site; staleness is estimated from the copyright year where present.'

  return `## Modernization Score

**${candidate.score} / 100** (100 = fully modern, lower = stronger case for modernization). ${scoreVerdict(candidate.score)}.

| Sub-score | Score | Weight |
|-----------|-------|--------|
${subScoreRows}
${missingNote}
Not in the score: ${informational.join(', ')}.

### Static HTML Signals

| Signal | Detected |
|--------|----------|
${staticSignalRows(candidate).join('\n')}

### Staleness

${staleness}
${candidate.notes ? `\nScoring notes: ${mdTableCell(candidate.notes)}\n` : ''}
`
}

export const generateReport = (
  schema: SiteSchema,
  nav: Array<{ label: string; url: string }>,
  // Optional market-discovery score for this site (a candidates.csv row). Omitted for
  // ad-hoc and --from-schema runs, where the report renders exactly as before.
  candidateScore?: CandidateScore
): string => {
  const { siteName, rootUrl, tagline, brandColors, pages } = schema
  const blockCounts = countBlocks(schema)
  const totalBlocks = Object.values(blockCounts).reduce((a, b) => a + b, 0)
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  const pageRows = pages
    .map((p) => {
      const route = urlToRoutePath(p.url, rootUrl)
      const component = urlToComponentName(p.url, rootUrl)
      const blockSummary = p.blocks.map((b) => blockTypeLabel[b.type] ?? b.type).join(', ')
      const titleCell = mdTableCell(String(p.title ?? p.url))
      return `| ${titleCell} | \`${route}\` | \`${component}\` | ${mdTableCell(blockSummary)} |`
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

## Philosophy

This run does **not** aim for a pixel-perfect copy of the source site. Legacy markup is input for extraction, not a design target to reproduce. The intent is to keep **information and site structure** (content, messaging, navigation, sections) while **resetting presentation**: a shared component library, responsive layout, and theme tokens instead of inherited CSS. The old look is deliberately left behind.

## Source Site

- **URL**: ${rootUrl}
- **Site name**: ${siteName}${tagline ? `\n- **Tagline**: ${tagline}` : ''}
- **Pages crawled**: ${pages.length}
- **Total content blocks extracted**: ${totalBlocks}

${candidateScore ? `${renderScoreSection(candidateScore)}\n` : ''}## What Changed

The source was likely a static or CMS-driven site with legacy HTML and CSS. Below is how that content was **restructured into a typed schema** and **regenerated** as a Next.js 15 app (React, Tailwind CSS v4, shadcn-style components)—a new presentation layer, not a clone of the original layout.

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

## Footer

${
  hasFooterContent(schema.footer)
    ? `Global \`Footer\` receives \`SiteSchema.footer\` (phone, email, address) from extraction and \`layout.tsx\` passes them as props. Nav links use the horizontal row under the site name.`
    : `No \`SiteSchema.footer\` on this schema — the generated footer shows site name and nav only. Add \`footer: { phone?, email?, address? }\` to include contact/location.`
}

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
