import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  buildPlacesQuery,
  candidatesToCsv,
  fetchHomepage,
  rankCandidates,
  readContinuingCandidates,
  scoreCandidate,
  scoreCandidates,
  toWaybackLookupUrl,
  dedupeByPlaceId,
  fetchAllPagesForQuery,
  greenfieldLeadsToCsv,
  isKnownChain,
  routeStage2,
  runDiscovery,
  type ContinuingCandidate,
  type RawPlaceResultWithVertical,
  type ScoredCandidate,
} from './discover-candidates.js'

// Fabricated (not recorded from a live call — no GOOGLE_PLACES_API_KEY is available in
// this environment) Places API (New) response shapes, matching the fields requested via
// the field mask in discover-candidates.ts. Used to build against and unit-test the
// pipeline without network access; confirm against a live call before trusting them.
interface FakePlace {
  id: string
  name: string
  websiteUri?: string
  userRatingCount?: number
  rating?: number
  nationalPhoneNumber?: string
  formattedAddress?: string
}

const textSearchPage = (
  places: FakePlace[],
  nextPageToken?: string
): { places: unknown[]; nextPageToken?: string } => ({
  places: places.map(({ name, ...rest }) => ({ ...rest, displayName: { text: name } })),
  ...(nextPageToken ? { nextPageToken } : {}),
})

describe('buildPlacesQuery', () => {
  it('formats business type, city, and state into a query string', () => {
    expect(buildPlacesQuery('plumber', { city: 'Austin', state: 'TX' })).toBe(
      'plumber Austin TX'
    )
  })
})

describe('isKnownChain', () => {
  it('matches known chains case-insensitively as a substring', () => {
    expect(isKnownChain("Domino's Pizza")).toBe(true)
    expect(isKnownChain('JIFFY LUBE #482')).toBe(true)
    expect(isKnownChain('jiffy lube of austin')).toBe(true)
  })

  it('does not match independent businesses', () => {
    expect(isKnownChain("Rosa's Family Diner")).toBe(false)
    expect(isKnownChain('Austin Plumbing Co')).toBe(false)
  })
})

describe('dedupeByPlaceId', () => {
  it('drops later duplicates and keeps first-seen order', () => {
    const records = [
      { placeId: 'a', n: 1 },
      { placeId: 'b', n: 2 },
      { placeId: 'a', n: 3 },
    ]
    expect(dedupeByPlaceId(records)).toEqual([
      { placeId: 'a', n: 1 },
      { placeId: 'b', n: 2 },
    ])
  })
})

describe('routeStage2', () => {
  const base: Omit<RawPlaceResultWithVertical, 'placeId' | 'name'> = {
    website: 'https://example.com',
    reviewCount: 50,
    rating: 4.5,
    phone: '(512) 555-0100',
    address: '1 Test St',
    vertical: 'plumber',
  }

  it('routes no-website results to greenfield regardless of review count', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p1', name: 'No Site Co', website: null, reviewCount: 1 },
    ]
    const { continuing, greenfield } = routeStage2(records)
    expect(continuing).toHaveLength(0)
    expect(greenfield).toHaveLength(1)
  })

  it('drops has-website results below the minimum review count', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p2', name: 'Too New Co', reviewCount: 4 },
    ]
    expect(routeStage2(records)).toEqual({ continuing: [], greenfield: [] })
  })

  it('keeps has-website results at the review count boundaries', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p3', name: 'Min Boundary Co', reviewCount: 5 },
      { ...base, placeId: 'p4', name: 'Max Boundary Co', reviewCount: 500 },
    ]
    expect(routeStage2(records).continuing).toHaveLength(2)
  })

  it('drops has-website results above the maximum review count', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p5', name: 'Too Big Co', reviewCount: 501 },
    ]
    expect(routeStage2(records)).toEqual({ continuing: [], greenfield: [] })
  })

  it('drops known chains even with a qualifying review count', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p6', name: "Domino's Pizza", reviewCount: 50 },
    ]
    expect(routeStage2(records)).toEqual({ continuing: [], greenfield: [] })
  })

  it('continues has-website, non-chain, in-range results', () => {
    const records: RawPlaceResultWithVertical[] = [
      { ...base, placeId: 'p7', name: 'Good Prospect Co', reviewCount: 50 },
    ]
    const { continuing } = routeStage2(records)
    expect(continuing).toEqual(records)
  })
})

describe('greenfieldLeadsToCsv', () => {
  it('writes the header and rows matching the doc schema exactly', () => {
    const csv = greenfieldLeadsToCsv([
      {
        businessName: 'Rosa\'s Diner',
        phone: '(512) 555-0100',
        address: '100 Main St, Austin, TX',
        city: 'Austin',
        state: 'TX',
        vertical: 'restaurant',
        reviewCount: 3,
        rating: 4.2,
        placeId: 'place-1',
      },
    ])

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(
      'business_name,phone,address,city,state,vertical,review_count,rating,place_id'
    )
    expect(lines[1]).toBe(
      'Rosa\'s Diner,(512) 555-0100,"100 Main St, Austin, TX",Austin,TX,restaurant,3,4.2,place-1'
    )
  })

  it('escapes embedded quotes', () => {
    const csv = greenfieldLeadsToCsv([
      {
        businessName: 'The "Best" Shop',
        phone: '',
        address: '',
        city: 'Austin',
        state: 'TX',
        vertical: 'plumber',
        reviewCount: 0,
        rating: null,
        placeId: 'place-2',
      },
    ])
    expect(csv).toContain('"The ""Best"" Shop"')
  })
})

describe('fetchAllPagesForQuery', () => {
  it('stops after 3 pages even when a next_page_token keeps being returned', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () =>
        textSearchPage(
          [{ id: `p-${Math.random()}`, name: 'Infinite Co', userRatingCount: 10 }],
          'always-another-token'
        ),
    })) as unknown as typeof fetch

    const results = await fetchAllPagesForQuery('plumber Austin TX', {
      apiKey: 'test-key',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(3)
  }, 10000)

  it('POSTs to the Places API (New) with key, field mask, and page token headers/body', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => textSearchPage([{ id: 'p1', name: 'One Co' }], 'tok-2'),
    }))
    const fetchImpl = fetchMock as unknown as typeof fetch

    await fetchAllPagesForQuery('plumber Austin TX', { apiKey: 'test-key', fetchImpl })

    const [firstCall, secondCall] = fetchMock.mock.calls
    if (!firstCall || !secondCall) throw new Error('expected two page requests')
    const [firstUrl, firstInit] = firstCall
    expect(firstUrl).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(firstInit.method).toBe('POST')
    const headers = firstInit.headers as Record<string, string>
    expect(headers['X-Goog-Api-Key']).toBe('test-key')
    expect(headers['X-Goog-FieldMask']).toContain('nextPageToken')
    expect(headers['X-Goog-FieldMask']).toContain('places.websiteUri')
    expect(JSON.parse(String(firstInit.body))).toEqual({
      textQuery: 'plumber Austin TX',
      pageSize: 20,
    })

    // Second page re-sends the same textQuery plus the token from page 1.
    expect(JSON.parse(String(secondCall[1].body))).toEqual({
      textQuery: 'plumber Austin TX',
      pageSize: 20,
      pageToken: 'tok-2',
    })
  }, 10000)

  it('returns no results when the response omits `places` entirely', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch

    const results = await fetchAllPagesForQuery('nothing Austin TX', {
      apiKey: 'test-key',
      fetchImpl,
    })
    expect(results).toEqual([])
  })
})

describe('runDiscovery', () => {
  it('throws when no API key is available', async () => {
    const originalKey = process.env['GOOGLE_PLACES_API_KEY']
    delete process.env['GOOGLE_PLACES_API_KEY']

    await expect(
      runDiscovery({ city: 'Austin', state: 'TX', businessTypes: ['plumber'] })
    ).rejects.toThrow('GOOGLE_PLACES_API_KEY')

    if (originalKey) process.env['GOOGLE_PLACES_API_KEY'] = originalKey
  })

  it('dedups, filters, and maps phone/address from the single Text Search call', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () =>
        textSearchPage([
          {
            id: 'continuing-1',
            name: 'Good Plumbing Co',
            websiteUri: 'https://goodplumbing.example.com',
            userRatingCount: 42,
            rating: 4.6,
            nationalPhoneNumber: '(512) 555-0101',
            formattedAddress: '1 Good St',
          },
          {
            id: 'greenfield-1',
            name: 'No Site Plumbing',
            userRatingCount: 8,
            rating: 3.9,
            nationalPhoneNumber: '(512) 555-0102',
            formattedAddress: '2 None St',
          },
          {
            id: 'dropped-chain',
            name: 'Jiffy Lube',
            websiteUri: 'https://jiffylube.example.com',
            userRatingCount: 200,
          },
          {
            id: 'dropped-review-count',
            name: 'Too Few Reviews Co',
            websiteUri: 'https://tinyco.example.com',
            userRatingCount: 2,
          },
        ]),
    }))
    const fetchImpl = fetchMock as unknown as typeof fetch

    const { continuing, greenfield } = await runDiscovery(
      { city: 'Austin', state: 'TX', businessTypes: ['plumber'] },
      { apiKey: 'test-key', fetchImpl }
    )

    expect(continuing).toEqual([
      {
        name: 'Good Plumbing Co',
        website: 'https://goodplumbing.example.com',
        placeId: 'continuing-1',
        reviewCount: 42,
        phone: '(512) 555-0101',
        address: '1 Good St',
        city: 'Austin',
        state: 'TX',
      },
    ])

    expect(greenfield).toEqual([
      {
        businessName: 'No Site Plumbing',
        phone: '(512) 555-0102',
        address: '2 None St',
        city: 'Austin',
        state: 'TX',
        vertical: 'plumber',
        reviewCount: 8,
        rating: 3.9,
        placeId: 'greenfield-1',
      },
    ])

    // One query, one page, no follow-up enrichment calls.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

const fetchResult = (
  finalUrl: string,
  html = '<html></html>'
): { html: string; statusCode: number; finalUrl: string } => ({
  html,
  statusCode: 200,
  finalUrl,
})

describe('fetchHomepage', () => {
  it('uses https when it works and reports SSL present', async () => {
    const fetchPage = vi.fn(async (url: string) => fetchResult(url))
    const result = await fetchHomepage('http://example.com', fetchPage)

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith('https://example.com')
    expect(result).toEqual({ html: '<html></html>', url: 'https://example.com', noSsl: false })
  })

  it('adds an https scheme to bare domains', async () => {
    const fetchPage = vi.fn(async (url: string) => fetchResult(url))
    await fetchHomepage('example.com', fetchPage)
    expect(fetchPage).toHaveBeenCalledWith('https://example.com')
  })

  it('falls back to http and flags no_ssl when https fails', async () => {
    const fetchPage = vi.fn(async (url: string) =>
      url.startsWith('https://') ? null : fetchResult(url)
    )
    const result = await fetchHomepage('https://example.com', fetchPage)

    expect(fetchPage).toHaveBeenLastCalledWith('http://example.com')
    expect(result?.noSsl).toBe(true)
  })

  it('does not flag no_ssl when the http fallback redirects to https', async () => {
    const fetchPage = vi.fn(async (url: string) =>
      url.startsWith('https://') ? null : fetchResult('https://example.com/')
    )
    const result = await fetchHomepage('https://example.com', fetchPage)
    expect(result?.noSsl).toBe(false)
  })

  it('returns null when neither fetch yields HTML', async () => {
    const fetchPage = vi.fn(async () => null)
    expect(await fetchHomepage('https://example.com', fetchPage)).toBeNull()
  })
})

describe('toWaybackLookupUrl', () => {
  it('strips scheme, query, and a bare root path', () => {
    expect(toWaybackLookupUrl('https://example.com/?utm_source=gmb')).toBe('example.com')
  })

  it('keeps a non-root path', () => {
    expect(toWaybackLookupUrl('https://example.com/austin/?ref=x')).toBe('example.com/austin/')
  })

  it('returns unparseable input unchanged', () => {
    expect(toWaybackLookupUrl('not a url')).toBe('not a url')
  })
})

const baseCandidate: ContinuingCandidate = {
  name: 'Good Plumbing Co',
  website: 'https://goodplumbing.example.com',
  placeId: 'p1',
  reviewCount: 42,
  phone: '(512) 555-0101',
  address: '1 Good St, Austin, TX',
  city: 'Austin',
  state: 'TX',
}

const MODERN_HTML = `<html><head>
  <meta name="viewport" content="width=device-width">
  <meta property="og:title" content="Modern">
</head><body><p>Modern site</p></body></html>`

describe('scoreCandidate', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  it('returns a static-only score when PSI is unavailable', async () => {
    const scored = await scoreCandidate(baseCandidate, {
      fetchPage: async (url) => fetchResult(url, MODERN_HTML),
      fetchSnapshots: async () => [],
      fetchPsi: async () => null,
      now,
    })

    expect(scored?.psiAvailable).toBe(false)
    expect(scored?.score).toBe(100)
    expect(scored?.staticScore.score).toBe(100)
    expect(scored?.stalenessSource).toBe('none')
  })

  it('combines static and PSI categories at 25% each', async () => {
    const scored = await scoreCandidate(baseCandidate, {
      fetchPage: async (url) => fetchResult(url, MODERN_HTML),
      fetchSnapshots: async () => [],
      fetchPsi: async () => ({ performance: 40, seo: 60, accessibility: 80, score: 61 }),
      now,
    })

    expect(scored?.psiAvailable).toBe(true)
    expect(scored?.score).toBe(100 * 0.25 + 40 * 0.25 + 60 * 0.25 + 80 * 0.25)
  })

  it('looks up staleness on the fetched URL without query params', async () => {
    const fetchSnapshots = vi.fn(async () => [{ timestamp: '20200101000000', digest: 'a' }])
    const scored = await scoreCandidate(
      { ...baseCandidate, website: 'https://goodplumbing.example.com/?utm_source=gmb' },
      {
        fetchPage: async (url) => fetchResult(url, MODERN_HTML),
        fetchSnapshots,
        fetchPsi: async () => null,
        now,
      }
    )

    expect(fetchSnapshots).toHaveBeenCalledWith('goodplumbing.example.com')
    expect(scored?.lastChanged).toBe('2020-01-01')
    // 6 years stale -> capped 20-point staleness weight
    expect(scored?.staticScore.score).toBe(80)
  })

  it('returns null when the homepage is unreachable', async () => {
    const scored = await scoreCandidate(baseCandidate, {
      fetchPage: async () => null,
      fetchSnapshots: async () => [],
      fetchPsi: async () => null,
    })
    expect(scored).toBeNull()
  })
})

const scoredFixture = (overrides: Partial<ScoredCandidate> = {}): ScoredCandidate => ({
  ...baseCandidate,
  score: 50,
  psiAvailable: false,
  staticScore: {
    score: 50,
    noSsl: false,
    noViewport: true,
    oldJquery: false,
    oldWpTheme: false,
    noOgTags: true,
    tableLayout: false,
    ieCompatible: false,
    notes: 'no_viewport, no_og_tags',
  },
  lastChanged: null,
  stalenessSource: 'none',
  psi: null,
  ...overrides,
})

describe('rankCandidates', () => {
  it('sorts by score ascending and keeps ties in input order', () => {
    const ranked = rankCandidates([
      scoredFixture({ name: 'C', score: 70 }),
      scoredFixture({ name: 'A1', score: 30 }),
      scoredFixture({ name: 'B', score: 50 }),
      scoredFixture({ name: 'A2', score: 30 }),
    ])
    expect(ranked.map(({ name }) => name)).toEqual(['A1', 'A2', 'B', 'C'])
  })
})

describe('scoreCandidates', () => {
  it('ranks reachable candidates and separates unreachable ones', async () => {
    const pages: Record<string, string> = {
      'https://modern.example.com': MODERN_HTML,
      'https://old.example.com': '<html><body><table><tr><td>Old</td></tr></table></body></html>',
    }
    const progress: number[] = []

    const { ranked, unreachable } = await scoreCandidates(
      [
        { ...baseCandidate, name: 'Modern', website: 'https://modern.example.com' },
        { ...baseCandidate, name: 'Gone', website: 'https://gone.example.com' },
        { ...baseCandidate, name: 'Old', website: 'https://old.example.com' },
      ],
      {
        fetchPage: async (url) => {
          const html = pages[url]
          return html ? fetchResult(url, html) : null
        },
        fetchSnapshots: async () => [],
        fetchPsi: async () => null,
        concurrency: 2,
        onProgress: ({ completed }) => progress.push(completed),
      }
    )

    expect(ranked.map(({ name }) => name)).toEqual(['Old', 'Modern'])
    expect(unreachable.map(({ name }) => name)).toEqual(['Gone'])
    expect(progress.sort()).toEqual([1, 2, 3])
  })
})

describe('candidatesToCsv', () => {
  it('writes the doc-specified header in exact order', () => {
    const [header] = candidatesToCsv([]).split('\n')
    expect(header).toBe(
      'business_name,phone,address,city,state,url,score,no_ssl,no_viewport,last_changed,' +
        'old_jquery,old_wp_theme,no_og_tags,table_layout,ie_compatible,static_score,' +
        'psi_score,psi_performance,psi_seo,psi_accessibility,notes'
    )
  })

  it('leaves PSI columns empty and notes static-only when PSI is unavailable', () => {
    const [, row] = candidatesToCsv([scoredFixture()]).split('\n')
    expect(row).toBe(
      'Good Plumbing Co,(512) 555-0101,"1 Good St, Austin, TX",Austin,TX,' +
        'https://goodplumbing.example.com,50,false,true,,false,false,true,false,false,50,' +
        ',,,,"no_viewport, no_og_tags, psi: unavailable, static-only score"'
    )
  })

  it('fills PSI columns rounded to one decimal when available', () => {
    const [, row] = candidatesToCsv([
      scoredFixture({
        address: '1 Good St',
        score: 47.123,
        psiAvailable: true,
        psi: { performance: 41.5, seo: 92, accessibility: 77.77, score: 72.58 },
        lastChanged: '2019-04-02',
        stalenessSource: 'wayback',
      }),
    ]).split('\n')

    const cells = row?.split(',') ?? []
    expect(cells[6]).toBe('47.1')
    expect(cells[9]).toBe('2019-04-02')
    expect(row).toContain(',72.6,41.5,92,77.8,')
  })
})

describe('readContinuingCandidates', () => {
  it('rejects a file that does not match the continuing-candidate shape', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'discover-'))
    const filePath = path.join(dir, 'continuing-candidates.json')
    await writeFile(filePath, JSON.stringify([{ name: 'Missing fields' }]), 'utf-8')

    await expect(readContinuingCandidates(filePath)).rejects.toThrow()
  })

  it('reads a valid handoff file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'discover-'))
    const filePath = path.join(dir, 'continuing-candidates.json')
    await writeFile(filePath, JSON.stringify([baseCandidate]), 'utf-8')

    expect(await readContinuingCandidates(filePath)).toEqual([baseCandidate])
  })
})
