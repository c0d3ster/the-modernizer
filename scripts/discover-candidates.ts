#!/usr/bin/env tsx
// Market discovery pipeline per docs/market-discovery.md "Full Programmatic Pipeline".
// Stage 1: Google Places API (New) Text Search per business type, paginated up to 3 pages.
// Phone and address come back in the same call via the field mask, so there is no separate
// Place Details step.
// Stage 2: dedup by place_id, then route by website presence / review count / known chain.
// Stage 3: fetch each continuing candidate's homepage (plain GET, no JS) and compute the
// static sub-score, including SSL and Wayback staleness.
// Stage 4: PageSpeed Insights categories when PSI_API_KEY is set (static-only otherwise).
// Stage 5: rank by final score ascending and write candidates.csv.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { Command } from 'commander'
import { staticFetch } from '@modernizer/crawler'
import type { StaticFetchResult } from '@modernizer/crawler'
import {
  computeFinalScore,
  computeStaleness,
  computeStaticScore,
  createRateLimiter,
  fetchCdxSnapshots,
  fetchPsiScore,
} from '@modernizer/discovery'
import type {
  CdxSnapshot,
  PsiScoreResult,
  StalenessSource,
  StaticScoreResult,
} from '@modernizer/discovery'
import { CANDIDATE_SCORE_COLUMNS } from '@modernizer/schema'
import { z } from 'zod'

const PLACES_TEXT_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

// Places API (New) requires a field mask; only the listed fields are returned (and billed).
// `nextPageToken` must be in the mask or pagination silently stops after page 1.
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.websiteUri',
  'places.userRatingCount',
  'places.rating',
  'places.nationalPhoneNumber',
  'places.formattedAddress',
  'nextPageToken',
].join(',')

// Courtesy delay between page requests for a single query.
const PAGE_DELAY_MS = 250
const PAGE_SIZE = 20
const MAX_PAGES_PER_QUERY = 3
const MIN_REVIEW_COUNT = 5
const MAX_REVIEW_COUNT = 500

const textSearchRateLimit = createRateLimiter(PAGE_DELAY_MS)

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
// PsiResponseSchema pattern. `websiteUri` is what routes a result to greenfield vs.
// continuing, so it deliberately stays optional rather than defaulting to a string.
const PlacesTextSearchPlaceSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  websiteUri: z.string().optional(),
  userRatingCount: z.number().optional(),
  rating: z.number().optional(),
  nationalPhoneNumber: z.string().optional(),
  formattedAddress: z.string().optional(),
})

// `places` is omitted entirely (not an empty array) when a query has no matches.
const PlacesTextSearchResponseSchema = z.object({
  places: z.array(PlacesTextSearchPlaceSchema).optional(),
  nextPageToken: z.string().optional(),
})

export interface RawPlaceResult {
  placeId: string
  name: string
  website: string | null
  reviewCount: number
  rating: number | null
  phone: string
  address: string
}

const mapTextSearchPlace = (
  place: z.infer<typeof PlacesTextSearchPlaceSchema>
): RawPlaceResult => ({
  placeId: place.id,
  name: place.displayName.text,
  website: place.websiteUri ?? null,
  reviewCount: place.userRatingCount ?? 0,
  rating: place.rating ?? null,
  phone: place.nationalPhoneNumber ?? '',
  address: place.formattedAddress ?? '',
})

const fetchTextSearchPage = async (
  query: string,
  pageToken: string | undefined,
  { apiKey, fetchImpl = fetch }: PlacesFetchOptions
): Promise<{ results: RawPlaceResult[]; nextPageToken: string | null }> => {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set')

  // textQuery is re-sent with every page; Google requires the same query params as the
  // request that issued the token.
  const response = await fetchImpl(PLACES_TEXT_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`Places Text Search HTTP ${response.status}: ${detail}`)
  }

  const json: unknown = await response.json()
  const parsed = PlacesTextSearchResponseSchema.parse(json)

  return {
    results: (parsed.places ?? []).map(mapTextSearchPlace),
    nextPageToken: parsed.nextPageToken ?? null,
  }
}

// Requests up to MAX_PAGES_PER_QUERY pages (60 results) for a single query, rate-limited
// with a small delay between pages.
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

// The full Stage 1 record per the doc, preserved (not trimmed to name/website/place_id/
// review_count) so candidates.csv and #9's outreach package have phone/address/
// city/state available.
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
      'GOOGLE_PLACES_API_KEY is not set. Set it in the environment to run discovery against the live Places API (New).'
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

  const continuing = continuingRaw.map(
    (record): ContinuingCandidate => ({
      name: record.name,
      website: record.website ?? '',
      placeId: record.placeId,
      reviewCount: record.reviewCount,
      phone: record.phone,
      address: record.address,
      city: config.city,
      state: config.state,
    })
  )

  const greenfield = greenfieldRaw.map(
    (record): GreenfieldLead => ({
      businessName: record.name,
      phone: record.phone,
      address: record.address,
      city: config.city,
      state: config.state,
      vertical: record.vertical,
      reviewCount: record.reviewCount,
      rating: record.rating,
      placeId: record.placeId,
    })
  )

  return { continuing, greenfield }
}

const csvEscape = (value: string | number | boolean): string => {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const toCsvRow = (values: (string | number | boolean)[]): string =>
  values.map(csvEscape).join(',')

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

// ---------------------------------------------------------------------------
// Stages 3-5: score continuing candidates and output the ranked candidates.csv
// ---------------------------------------------------------------------------

// PSI dominates wall-clock time (several seconds up to ~60s per URL), so candidates are
// scored a few at a time. Wayback CDX calls stay at 1 req/sec regardless, via the
// module-level rate limiter in @modernizer/discovery's fetchCdxSnapshots.
const DEFAULT_SCORING_CONCURRENCY = 4

export interface HomepageFetch {
  html: string
  url: string
  noSsl: boolean
}

const withScheme = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

/**
 * Fetches a candidate's homepage, probing https first so `no_ssl` can be detected per the
 * doc ("https:// fetch fails or returns a cert error"). Falls back to http so the other
 * signals can still be scored on a site with no SSL. If the http fetch redirects back to
 * https, SSL does work and only the first probe failed, so `noSsl` stays false.
 * Returns null when neither fetch yields usable HTML (unreachable, non-2xx, or a page too
 * thin for staticFetch's visible-text threshold).
 */
export const fetchHomepage = async (
  website: string,
  fetchPage: (url: string) => Promise<StaticFetchResult | null> = staticFetch
): Promise<HomepageFetch | null> => {
  const httpsUrl = withScheme(website).replace(/^http:\/\//i, 'https://')

  const httpsResult = await fetchPage(httpsUrl)
  if (httpsResult) {
    return { html: httpsResult.html, url: httpsResult.finalUrl, noSsl: false }
  }

  const httpResult = await fetchPage(httpsUrl.replace(/^https:\/\//i, 'http://'))
  if (!httpResult) return null

  return {
    html: httpResult.html,
    url: httpResult.finalUrl,
    noSsl: !/^https:\/\//i.test(httpResult.finalUrl),
  }
}

// Places website URIs often carry tracking params (e.g. `?utm_source=gmb`), and Wayback
// indexes by exact URL, so staleness is looked up on host + path only.
export const toWaybackLookupUrl = (url: string): string => {
  try {
    const { host, pathname } = new URL(url)
    return `${host}${pathname === '/' ? '' : pathname}`
  } catch {
    return url
  }
}

export interface ScoredCandidate extends ContinuingCandidate {
  score: number
  psiAvailable: boolean
  staticScore: StaticScoreResult
  lastChanged: string | null
  stalenessSource: StalenessSource
  psi: PsiScoreResult | null
}

export interface ScoringOptions {
  fetchPage?: (url: string) => Promise<StaticFetchResult | null>
  fetchSnapshots?: (url: string) => Promise<CdxSnapshot[]>
  fetchPsi?: (url: string) => Promise<PsiScoreResult | null>
  concurrency?: number
  now?: Date
  onProgress?: (event: ScoringProgress) => void
}

export interface ScoringProgress {
  candidate: ContinuingCandidate
  completed: number
  total: number
  scored: ScoredCandidate | null
}

export interface ScoringResult {
  // Sorted by score ascending: lowest score = best modernization prospect.
  ranked: ScoredCandidate[]
  // Candidates whose homepage couldn't be fetched at all, so they have no score.
  unreachable: ContinuingCandidate[]
}

export const scoreCandidate = async (
  candidate: ContinuingCandidate,
  {
    fetchPage = staticFetch,
    fetchSnapshots = fetchCdxSnapshots,
    fetchPsi = fetchPsiScore,
    now = new Date(),
  }: ScoringOptions = {}
): Promise<ScoredCandidate | null> => {
  // Stage 3: plain GET + static signals (SSL, viewport, staleness, etc.)
  const homepage = await fetchHomepage(candidate.website, fetchPage)
  if (!homepage) return null

  const staleness = await computeStaleness(toWaybackLookupUrl(homepage.url), homepage.html, {
    fetchSnapshots,
    now,
  })
  const staticScore = computeStaticScore({
    html: homepage.html,
    noSsl: homepage.noSsl,
    stalenessWeight: staleness.stalenessWeight,
  })

  // Stage 4: PSI. fetchPsiScore returns null without a key or on any failure.
  const psi = await fetchPsi(homepage.url)
  const final = computeFinalScore({ staticScore: staticScore.score, psiScore: psi })

  return {
    ...candidate,
    score: final.score,
    psiAvailable: final.psiAvailable,
    staticScore,
    lastChanged: staleness.lastChanged,
    stalenessSource: staleness.source,
    psi,
  }
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = []
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index] as T
      results[index] = await fn(item)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

// Stage 5 ordering. Array.prototype.sort is stable, so ties keep discovery order.
export const rankCandidates = (candidates: ScoredCandidate[]): ScoredCandidate[] =>
  [...candidates].sort((a, b) => a.score - b.score)

export const scoreCandidates = async (
  candidates: ContinuingCandidate[],
  options: ScoringOptions = {}
): Promise<ScoringResult> => {
  const { concurrency = DEFAULT_SCORING_CONCURRENCY, onProgress } = options
  let completed = 0

  const results = await mapWithConcurrency(candidates, concurrency, async (candidate) => {
    const scored = await scoreCandidate(candidate, options)
    completed++
    onProgress?.({ candidate, completed, total: candidates.length, scored })
    return { candidate, scored }
  })

  const scored = results.flatMap(({ scored }) => (scored ? [scored] : []))
  const unreachable = results.flatMap(({ candidate, scored }) => (scored ? [] : [candidate]))

  return { ranked: rankCandidates(scored), unreachable }
}

// Column order per docs/market-discovery.md "Output Format" > candidates.csv, shared with
// the report and outreach via @modernizer/schema's CandidateScore contract.
export const CANDIDATES_CSV_HEADER = CANDIDATE_SCORE_COLUMNS

const roundScore = (value: number): number => Math.round(value * 10) / 10

const buildCandidateNotes = (candidate: ScoredCandidate): string => {
  const parts = candidate.staticScore.notes ? [candidate.staticScore.notes] : []
  if (candidate.stalenessSource === 'copyright-fallback') {
    parts.push('staleness: copyright fallback (no Wayback data)')
  }
  if (!candidate.psiAvailable) parts.push('psi: unavailable, static-only score')
  return parts.join(', ')
}

export const candidatesToCsv = (candidates: ScoredCandidate[]): string => {
  const rows = candidates.map((candidate) => {
    const { staticScore, psi } = candidate
    return toCsvRow([
      candidate.name,
      candidate.phone,
      candidate.address,
      candidate.city,
      candidate.state,
      candidate.website,
      roundScore(candidate.score),
      staticScore.noSsl,
      staticScore.noViewport,
      candidate.lastChanged ?? '',
      staticScore.oldJquery,
      staticScore.oldWpTheme,
      staticScore.noOgTags,
      staticScore.tableLayout,
      staticScore.ieCompatible,
      roundScore(staticScore.score),
      psi ? roundScore(psi.score) : '',
      psi ? roundScore(psi.performance) : '',
      psi ? roundScore(psi.seo) : '',
      psi ? roundScore(psi.accessibility) : '',
      buildCandidateNotes(candidate),
    ])
  })
  return [toCsvRow([...CANDIDATES_CSV_HEADER]), ...rows].join('\n') + '\n'
}

export const writeCandidatesCsv = async (
  candidates: ScoredCandidate[],
  filePath: string
): Promise<void> => {
  await writeFile(filePath, candidatesToCsv(candidates), 'utf-8')
}

// Validates the interim continuing-candidates.json handoff file (written by a previous
// Stage 1-2 run) before scoring it, so a stale or hand-edited file fails loudly.
const ContinuingCandidatesFileSchema = z.array(
  z.object({
    name: z.string(),
    website: z.string().min(1),
    placeId: z.string(),
    reviewCount: z.number(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
  })
)

export const readContinuingCandidates = async (
  filePath: string
): Promise<ContinuingCandidate[]> => {
  const json: unknown = JSON.parse(await readFile(filePath, 'utf-8'))
  return ContinuingCandidatesFileSchema.parse(json)
}

interface CliOptions {
  city?: string
  state?: string
  types?: string
  outDir: string
  fromCandidates?: string
  concurrency: string
}

const program = new Command()

program
  .name('discover-candidates')
  .description(
    'Market-discovery pipeline (see docs/market-discovery.md): Google Places (New) search, dedup, and filter, then static + PSI scoring into a ranked candidates.csv'
  )
  .option('--city <city>', 'City to search (required unless --from-candidates)')
  .option('--state <state>', 'State to search, e.g. TX (required unless --from-candidates)')
  .option('--types <types>', "Comma-separated business types (default: the doc's target verticals)")
  .option('--out-dir <dir>', 'Directory to write output files to', '.')
  .option(
    '--from-candidates <path>',
    'Skip Stages 1-2 and score a continuing-candidates.json from a previous run (no Places API cost)'
  )
  .option('--concurrency <n>', 'Candidates scored in parallel', String(DEFAULT_SCORING_CONCURRENCY))

const loadCandidates = async (
  opts: CliOptions
): Promise<ContinuingCandidate[]> => {
  if (opts.fromCandidates) return readContinuingCandidates(opts.fromCandidates)

  if (!opts.city || !opts.state) {
    throw new Error('--city and --state are required unless --from-candidates is given')
  }

  const config: DiscoveryConfig = {
    city: opts.city,
    state: opts.state,
    businessTypes: opts.types
      ? opts.types.split(',').map((type) => type.trim())
      : DEFAULT_BUSINESS_TYPES,
  }

  const { continuing, greenfield } = await runDiscovery(config)

  const greenfieldPath = path.join(opts.outDir, 'greenfield-leads.csv')
  await writeGreenfieldCsv(greenfield, greenfieldPath)

  // Stage 2 -> 3 handoff file, so scoring can be re-run with --from-candidates without
  // repeating the Places API cost.
  const continuingPath = path.join(opts.outDir, 'continuing-candidates.json')
  await writeFile(continuingPath, JSON.stringify(continuing, null, 2), 'utf-8')

  process.stdout.write(
    `Discovered ${continuing.length} continuing candidate(s) -> ${continuingPath}\n` +
      `Discovered ${greenfield.length} greenfield lead(s) -> ${greenfieldPath}\n`
  )
  return continuing
}

program.action(async (opts: CliOptions) => {
  try {
    const concurrency = Number.parseInt(opts.concurrency, 10)
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error('--concurrency must be a positive integer')
    }

    await mkdir(opts.outDir, { recursive: true })
    const candidates = await loadCandidates(opts)

    if (!process.env['PSI_API_KEY']) {
      process.stderr.write('PSI_API_KEY is not set: scores will be static-only.\n')
    }

    const { ranked, unreachable } = await scoreCandidates(candidates, {
      concurrency,
      onProgress: ({ candidate, completed, total, scored }) => {
        const outcome = scored ? `score ${roundScore(scored.score)}` : 'unreachable, skipped'
        process.stderr.write(`[${completed}/${total}] ${candidate.name}: ${outcome}\n`)
      },
    })

    const candidatesPath = path.join(opts.outDir, 'candidates.csv')
    await writeCandidatesCsv(ranked, candidatesPath)

    process.stdout.write(
      `Scored ${ranked.length} candidate(s) -> ${candidatesPath}` +
        (unreachable.length ? ` (${unreachable.length} unreachable, skipped)` : '') +
        '\n'
    )
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
})

// Only parse argv when run directly — this file's own tests import the functions above
// without wanting commander to execute a CLI action as a side effect. Comparing via
// pathToFileURL (rather than a manual `file://${...}` template) is required on Windows,
// where process.argv[1] is backslash-separated and wouldn't otherwise match import.meta.url.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  program.parse()
}
