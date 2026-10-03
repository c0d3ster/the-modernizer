import { describe, expect, it, vi } from 'vitest'

import {
  buildPlacesQuery,
  dedupeByPlaceId,
  fetchAllPagesForQuery,
  greenfieldLeadsToCsv,
  isKnownChain,
  routeStage2,
  runDiscovery,
  type RawPlaceResultWithVertical,
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
