import { describe, expect, it } from 'vitest'

import {
  CANDIDATE_SCORE_COLUMNS,
  candidateScoreSchema,
  parseCandidatesCsv,
} from './candidate-score.js'

const HEADER = CANDIDATE_SCORE_COLUMNS.join(',')

// Hand-written to match what scripts/discover-candidates.ts emits: quoted cells with
// commas, booleans as true/false, empty PSI and last_changed cells when unavailable.
const FIXTURE_CSV = `${HEADER}
Rosa's Diner,(512) 555-0101,"12 Main St, Austin, TX",Austin,TX,https://rosasdiner.example.com,38.5,true,true,2016-03-01,true,true,true,true,false,22,63.4,41,72,77,"no_ssl, no_viewport, old_jquery, wp-theme: twentyfifteen, table_layout, no_og_tags, staleness_weight: 20"
Good Plumbing,(512) 555-0102,1 Good St,Austin,TX,https://goodplumbing.example.com,75,false,false,,false,false,true,false,false,75,,,,,"no_og_tags, psi: unavailable, static-only score"
`

describe('parseCandidatesCsv', () => {
  it('parses scored and static-only rows into typed values', () => {
    const [scored, staticOnly] = parseCandidatesCsv(FIXTURE_CSV)

    expect(scored).toMatchObject({
      business_name: "Rosa's Diner",
      address: '12 Main St, Austin, TX',
      score: 38.5,
      no_ssl: true,
      ie_compatible: false,
      last_changed: '2016-03-01',
      psi_score: 63.4,
      psi_accessibility: 77,
    })
    expect(staticOnly).toMatchObject({
      score: 75,
      last_changed: null,
      psi_score: null,
      psi_performance: null,
      psi_seo: null,
      psi_accessibility: null,
      notes: 'no_og_tags, psi: unavailable, static-only score',
    })
  })

  it('handles escaped quotes and CRLF line endings', () => {
    const row =
      '"Joe ""The Pipe"" Co",,,,,https://joe.example.com,50,false,false,,false,false,false,false,false,50,,,,,'
    const [parsed] = parseCandidatesCsv(`${HEADER}\r\n${row}\r\n`)
    expect(parsed?.business_name).toBe('Joe "The Pipe" Co')
  })

  it('rejects a header that does not match the column spec', () => {
    expect(() => parseCandidatesCsv('business_name,score\nA,1\n')).toThrow(
      'header'
    )
  })

  it('rejects an out-of-range score', () => {
    const row =
      'A,,,,,https://a.example.com,140,false,false,,false,false,false,false,false,50,,,,,'
    expect(() => parseCandidatesCsv(`${HEADER}\n${row}\n`)).toThrow('row 2')
  })
})

describe('candidateScoreSchema', () => {
  it('accepts already-typed values', () => {
    const parsed = candidateScoreSchema.parse({
      business_name: 'A',
      phone: '',
      address: '',
      city: 'Austin',
      state: 'TX',
      url: 'https://a.example.com',
      score: 50,
      no_ssl: false,
      no_viewport: false,
      last_changed: null,
      old_jquery: false,
      old_wp_theme: false,
      no_og_tags: false,
      table_layout: false,
      ie_compatible: false,
      static_score: 50,
      psi_score: null,
      psi_performance: null,
      psi_seo: null,
      psi_accessibility: null,
      notes: '',
    })
    expect(parsed.score).toBe(50)
  })
})
