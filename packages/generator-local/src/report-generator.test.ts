import { describe, expect, it } from 'vitest'
import {
  CANDIDATE_SCORE_COLUMNS,
  PageArchetype,
  parseCandidatesCsv,
} from '@modernizer/schema'
import type { CandidateScore, SiteSchema } from '@modernizer/schema'

import { generateReport } from './report-generator.js'

const schema: SiteSchema = {
  rootUrl: 'https://rosasdiner.example.com/',
  siteName: "Rosa's Diner",
  tagline: 'Home cooking since 1985',
  brandColors: { primary: '#b91c1c' },
  nav: [],
  pages: [
    {
      url: 'https://rosasdiner.example.com/',
      title: 'Home',
      archetype: PageArchetype.Home,
      blocks: [
        { type: 'hero', heading: 'Welcome to Rosa’s' },
        { type: 'text_section', body: 'Breakfast all day.' },
      ],
    },
    {
      url: 'https://rosasdiner.example.com/menu/',
      title: 'Menu | Specials',
      archetype: PageArchetype.Generic,
      blocks: [{ type: 'text_section', body: 'Pancakes, eggs, coffee.' }],
    },
  ],
}

const nav = [
  { label: 'Home', url: '/' },
  { label: 'Menu', url: '/menu' },
]

// Hand-written candidates.csv rows (no live pipeline run): one with every composite signal, one
// written before the composite columns existed (no PSI, no Wayback history).
const FIXTURE_CSV = `${CANDIDATE_SCORE_COLUMNS.join(',')}
Rosa's Diner,(512) 555-0101,"12 Main St, Austin, TX",Austin,TX,https://rosasdiner.example.com,38.5,true,true,2016-03-01,true,true,false,true,false,22,63.4,41,72,77,"no_ssl, no_viewport, staleness_weight: 20",restaurant,30,40,9,true,160,77,55,true
Rosa's Diner,(512) 555-0101,12 Main St,Austin,TX,https://rosasdiner.example.com,55,false,true,,false,false,true,false,true,55,,,,,"no_viewport, psi: unavailable, static-only score"
`

const [scoredWithPsi, scoredStaticOnly] = parseCandidatesCsv(FIXTURE_CSV) as [
  CandidateScore,
  CandidateScore,
]

describe('generateReport', () => {
  it('renders the page table with routes, components, and escaped titles', () => {
    const report = generateReport(schema, nav)

    expect(report).toContain('## Pages Generated (2)')
    expect(report).toContain('| Home | `src/app/page.tsx` | `HomePage` |')
    expect(report).toContain('| Menu \\| Specials | `src/app/menu/page.tsx` | `MenuPage` |')
    expect(report).toContain('Hero banner, Text section')
  })

  it('renders block counts sorted by frequency', () => {
    const report = generateReport(schema, nav)

    expect(report).toContain('- **Total content blocks extracted**: 3')
    expect(report.indexOf('| Text section | 2 |')).toBeLessThan(
      report.indexOf('| Hero banner | 1 |')
    )
  })

  it('omits the score section when no candidate score is given', () => {
    const report = generateReport(schema, nav)

    expect(report).not.toContain('Modernization Score')
    expect(report).toContain(
      '- **Total content blocks extracted**: 3\n\n## What Changed'
    )
  })

  it('renders the overall score, sub-scores, signals, and staleness', () => {
    const report = generateReport(schema, nav, scoredWithPsi)

    expect(report).toContain('## Modernization Score')
    expect(report).toContain('**38.5 / 100**')
    expect(report).toContain('Pitch candidate: below the pitch threshold of 81')
    expect(report).toContain('| Visual design (screenshots) | 30 | 50% |')
    expect(report).toContain('| Static HTML | 40 | 10% |')
    expect(report).toContain('| Build quality (Lighthouse audits) | 55 | 10% |')
    expect(report).toContain('| SEO (Lighthouse) | 72 | 10% |')
    expect(report).toContain('| Accessibility (Lighthouse) | 77 | 10% |')
    expect(report).toContain('| Best Practices (Lighthouse) | 77 | 10% |')
    expect(report).toContain('Not in the score: Lighthouse performance (mobile) 41, legacy static HTML score 22.')
    expect(report).not.toContain('reweighted')
    expect(report).toContain('| Years since the copyright year | 9 |')
    expect(report).toContain('| Inline style attributes | 160 |')
    expect(report).toContain('| No HTTPS / expired SSL | Yes |')
    expect(report).toContain('| No Open Graph tags | No |')
    expect(report).toContain('Content last changed **2016-03-01**')
    expect(report).toContain(
      'Scoring notes: no_ssl, no_viewport, staleness_weight: 20'
    )
    // Section sits between the source summary and the stack comparison.
    expect(report.indexOf('## Source Site')).toBeLessThan(
      report.indexOf('## Modernization Score')
    )
    expect(report.indexOf('## Modernization Score')).toBeLessThan(
      report.indexOf('## What Changed')
    )
  })

  it('renders a row from before the composite columns, without PSI or Wayback data', () => {
    const report = generateReport(schema, nav, scoredStaticOnly)

    expect(report).toContain('**55 / 100**')
    expect(report).toContain('Pitch candidate')
    expect(report).toContain('| Visual design (screenshots) | n/a | 50% |')
    expect(report).toContain('| SEO (Lighthouse) | n/a | 10% |')
    expect(report).toContain('the others were reweighted to fill their share')
    expect(report).toContain('Not in the score: legacy static HTML score 55.')
    expect(report).toContain('| No responsive images (srcset) | n/a |')
    expect(report).toContain('No Wayback Machine history')
    expect(report).toContain('| IE compatibility meta tag | Yes |')
  })

  it('labels a score at or above the threshold as already fairly modern', () => {
    const report = generateReport(schema, nav, {
      ...scoredStaticOnly,
      score: 81,
    })
    expect(report).toContain('Above the pitch threshold of 81: already fairly modern')
  })
})
