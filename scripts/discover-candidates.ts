#!/usr/bin/env tsx
// Market discovery Stages 1-2 per docs/market-discovery.md "Full Programmatic Pipeline".
// Stage 1: Google Places Text Search per business type, paginated up to 3 pages.
// Stage 2: dedup by place_id, then route by website presence / review count / known chain.
//
// Continued by `#5`, which adds Stages 3-5 (static + PSI scoring, ranked candidates.csv
// output) to this same file. `#5` imports `runDiscovery` (and the types below) directly
// rather than round-tripping through a file, since it runs in the same process.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { Command } from 'commander'
import { createRateLimiter } from '@modernizer/discovery'
import { z } from 'zod'

const PLACES_TEXT_SEARCH_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const PLACES_DETAILS_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json'

// Google activates a Text Search `next_page_token` ~2s after it's issued; requesting the
// next page sooner returns INVALID_REQUEST. Reused as a general courtesy delay between
// Details calls too, via a second limiter below.
const PAGE_TOKEN_DELAY_MS = 2000
const MAX_PAGES_PER_QUERY = 3
const MIN_REVIEW_COUNT = 5
const MAX_REVIEW_COUNT = 500

const textSearchRateLimit = createRateLimiter(PAGE_TOKEN_DELAY_MS)
const detailsRateLimit = createRateLimiter(100)

// Per docs/market-discovery.md Method P1 query templates.
export const DEFAULT_BUSINESS_TYPES = [
  'restaurant',
  'plumber',
  'hvac contractor',
  'auto body shop',
  'chiropractor',
  'dentist',
  'personal injury attorney',
  'veterinarian',
]

// Starter list of common national/regional chains, matched case-insensitively as a
// substring of the business name. The doc gives no algorithm beyond two examples
// (Domino's, Jiffy Lube) — this is a starting point to expand as more chains turn up
// in real results, not an exhaustive list.
const KNOWN_CHAINS = [
  "domino's",
  'jiffy lube',
  'pizza hut',
  "papa john's",
  'subway',
  "mcdonald's",
  'starbucks',
  'great clips',
  'supercuts',
  'sport clips',
  'h&r block',
  'valvoline',
  'midas',
  'firestone',
  'aamco',
  'meineke',
  'les schwab',
  'taco bell',
  'burger king',
  "wendy's",
  'chipotle',
  'panera bread',
]

export const isKnownChain = (name: string): boolean => {
  const lower = name.toLowerCase()
  return KNOWN_CHAINS.some((chain) => lower.includes(chain))
}

export interface DiscoveryConfig {
  city: string
  state: string
  businessTypes: string[]
}

export const buildPlacesQuery = (
  businessType: string,
  config: Pick<DiscoveryConfig, 'city' | 'state'>
): string => `${businessType} ${config.city} ${config.state}`

export interface PlacesFetchOptions {
  apiKey?: string
  fetchImpl?: typeof fetch
}

// Untrusted external API boundary — validated rather than cast, matching psi-score.ts's
// PsiResponseSchema pattern. `website` is what routes a result to greenfield vs.
// continuing, so it deliberately stays optional rather than defaulting to a string.
const PlacesTextSearchResultSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  website: z.string().optional(),
  user_ratings_total: z.number().optional(),
  rating: z.number().optional(),
})

const PlacesTextSearchResponseSchema = z.object({
  results: z.array(PlacesTextSearchResultSchema),
  next_page_token: z.string().optional(),
})

export interface RawPlaceResult {
  placeId: string
  name: string
  website: string | null
  reviewCount: number
  rating: number | null
}

const mapTextSearchResult = (
  result: z.infer<typeof PlacesTextSearchResultSchema>
): RawPlaceResult => ({
  placeId: result.place_id,
  name: result.name,
  website: result.website ?? null,
  reviewCount: result.user_ratings_total ?? 0,
  rating: result.rating ?? null,
})

const fetchTextSearchPage = async (
  query: string,
  pageToken: string | undefined,
  { apiKey, fetchImpl = fetch }: PlacesFetchOptions
): Promise<{ results: RawPlaceResult[]; nextPageToken: string | null }> => {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set')

  const params = new URLSearchParams({ key: apiKey })
  if (pageToken) {
    params.set('pagetoken', pageToken)
  } else {
    params.set('query', query)
  }

  const response = await fetchImpl(`${PLACES_TEXT_SEARCH_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Places Text Search HTTP ${response.status}`)

  const json: unknown = await response.json()
  const parsed = PlacesTextSearchResponseSchema.parse(json)

  return {
    results: parsed.results.map(mapTextSearchResult),
    nextPageToken: parsed.next_page_token ?? null,
  }
}

// Requests up to MAX_PAGES_PER_QUERY pages (60 results) for a single query, rate-limited
// to respect the next_page_token activation delay.
export const fetchAllPagesForQuery = async (
  query: string,
  options: PlacesFetchOptions
): Promise<RawPlaceResult[]> => {
  const allResults: RawPlaceResult[] = []
  let pageToken: string | undefined
  let pagesFetched = 0

  do {
    await textSearchRateLimit()
    const page = await fetchTextSearchPage(query, pageToken, options)
    allResults.push(...page.results)
    pageToken = page.nextPageToken ?? undefined
    pagesFetched += 1
  } while (pageToken && pagesFetched < MAX_PAGES_PER_QUERY)

  return allResults
}

export const dedupeByPlaceId = <T extends { placeId: string }>(records: T[]): T[] => {
  const seen = new Set<string>()
  const deduped: T[] = []
  for (const record of records) {
    if (seen.has(record.placeId)) continue
    seen.add(record.placeId)
    deduped.push(record)
  }
  return deduped
}

export interface RawPlaceResultWithVertical extends RawPlaceResult {
  vertical: string
}

export interface Stage2Routing {
  continuing: RawPlaceResultWithVertical[]
  greenfield: RawPlaceResultWithVertical[]
}

// Per docs/market-discovery.md Stage 2: no-website results route straight to greenfield,
// unconditionally — the doc's flowchart only applies the review_count and chain filters
// on the has-website branch.
export const routeStage2 = (records: RawPlaceResultWithVertical[]): Stage2Routing => {
  const continuing: RawPlaceResultWithVertical[] = []
  const greenfield: RawPlaceResultWithVertical[] = []

  for (const record of records) {
    if (!record.website) {
      greenfield.push(record)
      continue
    }
    if (record.reviewCount < MIN_REVIEW_COUNT || record.reviewCount > MAX_REVIEW_COUNT) continue
    if (isKnownChain(record.name)) continue
    continuing.push(record)
  }

  return { continuing, greenfield }
}

const PlaceDetailsResponseSchema = z.object({
  result: z.object({
    formatted_phone_number: z.string().optional(),
    formatted_address: z.string().optional(),
  }),
})

export interface PlaceDetails {
  phone: string
  address: string
}

// formatted_phone_number and formatted_address aren't returned by Text Search per the
// doc's note — fetched here, after Stage 2 filtering, so Details calls are never spent
// on businesses that were just dropped.
export const fetchPlaceDetails = async (
  placeId: string,
  { apiKey, fetchImpl = fetch }: PlacesFetchOptions
): Promise<PlaceDetails> => {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set')

  await detailsRateLimit()

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'formatted_phone_number,formatted_address',
    key: apiKey,
  })

  const response = await fetchImpl(`${PLACES_DETAILS_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Places Details HTTP ${response.status}`)

  const json: unknown = await response.json()
  const parsed = PlaceDetailsResponseSchema.parse(json)

  return {
    phone: parsed.result.formatted_phone_number ?? '',
    address: parsed.result.formatted_address ?? '',
  }
}

// The full Stage 1 record per the doc, preserved (not trimmed to name/website/place_id/
// review_count) so #5's candidates.csv and #9's outreach package have phone/address/
// city/state available without re-fetching Details.
export interface ContinuingCandidate {
  name: string
  website: string
  placeId: string
  reviewCount: number
  phone: string
  address: string
  city: string
  state: string
}

// Matches the doc's greenfield-leads.csv schema exactly:
// business_name, phone, address, city, state, vertical, review_count, rating, place_id.
export interface GreenfieldLead {
  businessName: string
  phone: string
  address: string
  city: string
  state: string
  vertical: string
  reviewCount: number
  rating: number | null
  placeId: string
}

export interface DiscoveryResult {
  continuing: ContinuingCandidate[]
  greenfield: GreenfieldLead[]
}

export const runDiscovery = async (
  config: DiscoveryConfig,
  options: PlacesFetchOptions = {}
): Promise<DiscoveryResult> => {
  const apiKey = options.apiKey ?? process.env['GOOGLE_PLACES_API_KEY']
  if (!apiKey) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY is not set. Set it in the environment to run discovery against the live Places API.'
    )
  }
  const fetchOptions: PlacesFetchOptions = { ...options, apiKey }

  const allRaw: RawPlaceResultWithVertical[] = []

  for (const businessType of config.businessTypes) {
    const query = buildPlacesQuery(businessType, config)
    try {
      const results = await fetchAllPagesForQuery(query, fetchOptions)
      allRaw.push(...results.map((result) => ({ ...result, vertical: businessType })))
    } catch (err) {
      process.stderr.write(
        `Skipping query "${query}": ${err instanceof Error ? err.message : String(err)}\n`
      )
    }
  }

  const { continuing: continuingRaw, greenfield: greenfieldRaw } = routeStage2(
    dedupeByPlaceId(allRaw)
  )

  const continuing = await Promise.all(
    continuingRaw.map(async (record): Promise<ContinuingCandidate> => {
      const details = await fetchPlaceDetails(record.placeId, fetchOptions)
      return {
        name: record.name,
        website: record.website ?? '',
        placeId: record.placeId,
        reviewCount: record.reviewCount,
        phone: details.phone,
        address: details.address,
        city: config.city,
        state: config.state,
      }
    })
  )

  const greenfield = await Promise.all(
    greenfieldRaw.map(async (record): Promise<GreenfieldLead> => {
      const details = await fetchPlaceDetails(record.placeId, fetchOptions)
      return {
        businessName: record.name,
        phone: details.phone,
        address: details.address,
        city: config.city,
        state: config.state,
        vertical: record.vertical,
        reviewCount: record.reviewCount,
        rating: record.rating,
        placeId: record.placeId,
      }
    })
  )

  return { continuing, greenfield }
}

const csvEscape = (value: string | number): string => {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const toCsvRow = (values: (string | number)[]): string => values.map(csvEscape).join(',')

const GREENFIELD_CSV_HEADER = [
  'business_name',
  'phone',
  'address',
  'city',
  'state',
  'vertical',
  'review_count',
  'rating',
  'place_id',
]

export const greenfieldLeadsToCsv = (leads: GreenfieldLead[]): string => {
  const rows = leads.map((lead) =>
    toCsvRow([
      lead.businessName,
      lead.phone,
      lead.address,
      lead.city,
      lead.state,
      lead.vertical,
      lead.reviewCount,
      lead.rating ?? '',
      lead.placeId,
    ])
  )
  return [toCsvRow(GREENFIELD_CSV_HEADER), ...rows].join('\n') + '\n'
}

export const writeGreenfieldCsv = async (leads: GreenfieldLead[], filePath: string): Promise<void> => {
  await writeFile(filePath, greenfieldLeadsToCsv(leads), 'utf-8')
}

interface CliOptions {
  city: string
  state: string
  types?: string
  outDir: string
}

const program = new Command()

program
  .name('discover-candidates')
  .description(
    'Stage 1-2 of the market-discovery pipeline: Google Places search, dedup, and filter (see docs/market-discovery.md)'
  )
  .requiredOption('--city <city>', 'City to search')
  .requiredOption('--state <state>', 'State to search (e.g. TX)')
  .option('--types <types>', "Comma-separated business types (default: the doc's target verticals)")
  .option('--out-dir <dir>', 'Directory to write output files to', '.')

program.action(async (opts: CliOptions) => {
  const config: DiscoveryConfig = {
    city: opts.city,
    state: opts.state,
    businessTypes: opts.types
      ? opts.types.split(',').map((type) => type.trim())
      : DEFAULT_BUSINESS_TYPES,
  }

  try {
    const { continuing, greenfield } = await runDiscovery(config)

    const greenfieldPath = path.join(opts.outDir, 'greenfield-leads.csv')
    await writeGreenfieldCsv(greenfield, greenfieldPath)

    // Interim Stage 2 -> Stage 3 handoff file so a local re-run doesn't repeat the Places
    // API cost while #5 is under development. #5 can also import runDiscovery directly.
    const continuingPath = path.join(opts.outDir, 'continuing-candidates.json')
    await writeFile(continuingPath, JSON.stringify(continuing, null, 2), 'utf-8')

    process.stdout.write(
      `Discovered ${continuing.length} continuing candidate(s) -> ${continuingPath}\n` +
        `Discovered ${greenfield.length} greenfield lead(s) -> ${greenfieldPath}\n`
    )
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
})

// Only parse argv when run directly — #5 (and this file's own tests) import the functions
// above without wanting commander to execute a CLI action as a side effect. Comparing via
// pathToFileURL (rather than a manual `file://${...}` template) is required on Windows,
// where process.argv[1] is backslash-separated and wouldn't otherwise match import.meta.url.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  program.parse()
}
