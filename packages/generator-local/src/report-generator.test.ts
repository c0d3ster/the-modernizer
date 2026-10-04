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

// Hand-written candidates.csv rows (no live pipeline run): one with PSI data, one
// static-only with no Wayback history.
const FIXTURE_CSV = `${CANDIDATE_SCORE_COLUMNS.join(',')}
Rosa's Diner,(512) 555-0101,"12 Main St, Austin, TX",Austin,TX,https://rosasdiner.example.com,38.5,true,true,2016-03-01,true,true,false,true,false,22,63.4,41,72,77,"no_ssl, no_viewport, staleness_weight: 20"
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
    expect(report).toContain('Strong candidate')
    expect(report).toContain('| Static HTML | 22 | 25% |')
    expect(report).toContain('| Performance (Lighthouse, mobile) | 41 | 25% |')
    expect(report).toContain('| SEO (Lighthouse) | 72 | 25% |')
    expect(report).toContain('| Accessibility (Lighthouse) | 77 | 25% |')
    expect(report).toContain(
      'PSI composite (informational, not part of the final score): 63.4'
    )
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

  it('renders a static-only score without PSI or Wayback data', () => {
    const report = generateReport(schema, nav, scoredStaticOnly)

    expect(report).toContain('**55 / 100**')
    expect(report).toContain('Moderate candidate')
    expect(report).toContain('| Performance (Lighthouse, mobile) | n/a | 25% |')
    expect(report).toContain('the final score is the static HTML score alone')
    expect(report).not.toContain('PSI composite')
    expect(report).toContain('No Wayback Machine history')
    expect(report).toContain('| IE compatibility meta tag | Yes |')
  })

  it('labels high scores as already modern', () => {
    const report = generateReport(schema, nav, {
      ...scoredStaticOnly,
      score: 82,
    })
    expect(report).toContain('Already fairly modern')
  })
})
