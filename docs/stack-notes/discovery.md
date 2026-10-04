# Stack: discovery

## `#3` Implement PSI sub-score

Branch: overnight/2026-09-22/01-psi-subscore

### Decisions

- **API key naming — resolved for the whole stack:** separate keys per API, not one
  shared `GOOGLE_API_KEY`. PSI uses `PSI_API_KEY`; `#4` should use `GOOGLE_PLACES_API_KEY`
  for Places (as `#4`'s own task text already proposed). Rationale: Google Cloud API keys
  can be restricted to specific APIs, and separate keys let each be scoped to least
  privilege independently; both tasks' proposed names already assumed separate keys
  before this cross-task consistency check existed, so this just confirms that default
  rather than introducing a new one. `#4` (and any later task reading Places/PSI keys)
  should follow this — do not introduce `GOOGLE_API_KEY`.
- **Auto-degrade on missing key, no CLI flag:** `fetchPsiScore` (in `psi-score.ts`) reads
  `process.env['PSI_API_KEY']` itself and returns `null` immediately if absent — mirrors
  `requestHeroImageBytes`'s `GEMINI_API_KEY` check in
  `packages/generator-claude/src/hero-image.ts`. `apiKey`/`fetchImpl` are injectable via an
  options param for testing, but production callers pass neither.
- **`null` is the "PSI unavailable" signal, not an error:** `fetchPsiScore` returns `null`
  for a missing key, a non-ok HTTP response, a network error, *and* a malformed/partial
  response (Zod schema requires all three Lighthouse categories present — missing any one
  fails validation). All four cases are indistinguishable to the caller by design; PSI
  being flaky isn't a pipeline failure.
- **Static-only fallback lives in `final-score.ts`, not `psi-score.ts`:** `computeFinalScore`
  takes `psiScore: PsiScoreResult | null` and, when `null`, returns
  `{ score: staticScore, psiAvailable: false }` instead of applying the 50/50 weights.
  When PSI is present, `psiAvailable: true` and the documented
  `static × 0.50 + psi × 0.50` formula applies.
- Added `zod` (`^3.24.2`, matching the version already used in `packages/extractor`,
  `packages/generator-claude`, `packages/schema`) as a new dependency of
  `packages/discovery` — this package had no runtime JSON validation before.
- Declared `PSI_API_KEY` in root `turbo.json`'s `globalEnv` (alongside the existing
  `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` entries) — required by the
  `turbo/no-undeclared-env-vars` lint rule.

### Interfaces / exports created (all re-exported from `packages/discovery/src/index.ts`)

- `psi-score.ts`: `computePsiScore(categories: PsiCategoryScores): number` (pure formula,
  unit-tested directly against fixture category scores per the acceptance criteria),
  `fetchPsiScore(url, options?): Promise<PsiScoreResult | null>`, `PSI_SCORE_WEIGHTS`,
  types `PsiCategoryScores`, `PsiScoreResult`, `PsiScoreOptions`.
- `final-score.ts`: `computeFinalScore({ staticScore, psiScore }): FinalScoreResult`,
  `FINAL_SCORE_WEIGHTS`, types `FinalScoreInput`, `FinalScoreResult`
  (`{ score: number; psiAvailable: boolean }`).

### Deviations from acceptance criteria

- **"final score computed end to end for a live URL when key is present"** — not verified
  live in this session: no `PSI_API_KEY` is set in this environment (confirmed absent,
  along with `GOOGLE_API_KEY`/`GOOGLE_PLACES_API_KEY`). The success path is covered by a
  unit test with a mocked `fetchImpl` returning a realistic PSI response shape instead.
  Flagged as `NEEDS HUMAN` in TASKS.md/PR: set `PSI_API_KEY` (a Google Cloud API key with
  the PageSpeed Insights API enabled) and run `computeFinalScore` with `fetchPsiScore`
  against a real URL to confirm end to end.
- All other acceptance criteria (formula unit test, Zod validation, malformed/partial
  result handling, `psiAvailable` field, static-only degrade) are implemented and covered
  by tests in `psi-score.test.ts` and `final-score.test.ts`.

## `#4` Implement discovery Stages 1-2 (Places search, dedup, filter)

Branch: overnight/2026-09-22/02-discover-candidates

### Decisions

- **`scripts/` added to the pnpm workspace, not left ungoverned:** created
  `scripts/package.json` (`@modernizer/scripts`) alongside the doc-specified
  `scripts/discover-candidates.ts`, wired into `pnpm-workspace.yaml` (`"scripts"` — a
  literal path, not a glob, since it's a single package directory, not a container of
  packages). Rationale: this file has real business logic (dedup, chain/review-count
  filtering, CSV generation, pagination) that benefits from `tsc --noEmit` + `vitest` +
  eslint parity with the rest of the repo, matching how `apps/discovery-cli` already
  established the pattern for operational discovery tooling. Left ungoverned, `turbo run
  lint/check-types/test` would silently never touch this file. The precedent the task
  text flagged as a counter-argument (`scripts/compare-generators.sh`, referenced directly
  from root `package.json` without workspace membership) is a plain bash script with
  nothing to type-check or unit-test, so it isn't a close comparison.
- **`GOOGLE_PLACES_API_KEY` confirmed, not reopened:** `#3`'s stack note already resolved
  the separate-keys-per-API decision and named this exact var for Places; declared it in
  root `turbo.json`'s `globalEnv` (required by `turbo/no-undeclared-env-vars`).
- **No key present → hard error, not a null-degrade:** unlike `fetchPsiScore` (optional
  sub-score, degrades to `null`), Places is Stage 1's only data source — there's no
  meaningful output without it. `runDiscovery` throws immediately if
  `GOOGLE_PLACES_API_KEY` is unset (checked once up front, not per-call).
- **Stage 2 routing follows the doc's flowchart literally:** no-website results route to
  greenfield unconditionally; the review-count (`<5` or `>500`) and known-chain filters
  only apply on the has-website branch. The doc's flowchart never applies those filters to
  the no-website branch, so a review-heavy or chain-named business with no website still
  becomes a greenfield lead.
- **Places API (New), no Place Details step:** migrated from the legacy Places API (not
  available to new Google Cloud projects) to `places:searchText`. Phone and address are
  requested in the same call via `X-Goog-FieldMask`, so the earlier "Details only after
  Stage 2 filtering" step and its rate limiter were removed. Website/rating/review count
  already force the Enterprise tier, so phone/address add no extra tier cost.
- **`city`/`state` on output records come from the input config, not parsed from
  `formatted_address`:** matches what "given config (city, state, business types)"
  implies the acceptance criteria wants, and avoids fragile address-string parsing.
- **Known-chain detection:** `isKnownChain` does case-insensitive substring matching
  against a hardcoded starter list (~20 common national/regional service-business chains,
  seeded from the doc's two examples). Documented in-code as a starting point to expand,
  not an exhaustive list.
- **CSV writing is hand-rolled**, not a new dependency: only two flat, doc-specified
  schemas, so a ~10-line escape/join helper was simpler than pulling in a CSV library.
- **Pagination rate limiting reuses `@modernizer/discovery`'s `createRateLimiter`**
  (250ms courtesy delay between pages; the New API has no documented token activation
  delay) rather than duplicating that logic — added `@modernizer/discovery` as a dependency of `scripts`.
- **Cross-platform CLI entrypoint guard:** the usual `import.meta.url ===
  file://${process.argv[1]}` check silently fails on Windows (backslash-separated
  `argv[1]` vs. forward-slash `file:///` URL), so `discover-candidates.ts` never ran when
  invoked via `pnpm discover-candidates` — caught by actually running the CLI locally, not
  by the test suite. Fixed with `node:url`'s `pathToFileURL(...).href` instead. Worth
  checking for the same pattern if `#5` or later tasks add another CLI entrypoint in this
  package.

### Interfaces / exports created (all in `scripts/discover-candidates.ts`, no barrel —
single-file package)

- Config: `DiscoveryConfig`, `DEFAULT_BUSINESS_TYPES` (the doc's 8 target verticals).
- Stage 1: `buildPlacesQuery`, `fetchAllPagesForQuery`, `RawPlaceResult`.
- Stage 2: `dedupeByPlaceId`, `isKnownChain`, `routeStage2`, `RawPlaceResultWithVertical`,
  `Stage2Routing`, `fetchPlaceDetails`, `PlaceDetails`.
- Orchestration: `runDiscovery(config, options?) => Promise<{ continuing:
  ContinuingCandidate[]; greenfield: GreenfieldLead[] }>` — this is what `#5` should import
  to continue the pipeline in-process. `ContinuingCandidate` preserves the full Stage 1
  record (`name, website, placeId, reviewCount, phone, address, city, state`);
  `GreenfieldLead` matches the doc's `greenfield-leads.csv` schema exactly.
- Output: `greenfieldLeadsToCsv` (pure string builder, tested separately from disk I/O),
  `writeGreenfieldCsv`.
- All Places/Details fetch functions take an options object (`apiKey`, `fetchImpl`)
  matching `fetchPsiScore`'s injectable-for-testing pattern in `packages/discovery`.
- CLI: `pnpm discover-candidates --city <city> --state <state> [--types
  <comma-separated>] [--out-dir <dir>]`. Writes `greenfield-leads.csv` (doc-specified) and
  an interim `continuing-candidates.json` (not doc-specified — a Stage 2→3 handoff so a
  local re-run doesn't repeat Places API cost while `#5` is under development; `#5` can
  also skip this file entirely and import `runDiscovery` directly).

### Deviations from acceptance criteria

- **No live Places API run:** `GOOGLE_PLACES_API_KEY` is not set in this environment
  (confirmed absent). Built and tested entirely against fabricated fixture response
  shapes (documented as fabricated, not recorded, in
  `scripts/discover-candidates.test.ts` — matching the fields requested in the Places
  API (New) field mask) via the injectable `fetchImpl` option. Flagged as `NEEDS
  HUMAN` in TASKS.md/PR: set `GOOGLE_PLACES_API_KEY` (a Google Cloud API key with the
  Places API (New) enabled) and run `pnpm discover-candidates --city <city> --state <state>`
  against real data to confirm the response shapes this task assumed (field names,
  `places` omitted on empty results, `nextPageToken` pagination) hold against the live API.
- All other acceptance criteria — filtered continuing-candidate list preserving the full
  Stage 1 record, separate `greenfield-leads.csv` with the doc's exact schema, pagination
  capped at 3 pages, dedup, known-chain starter list — are implemented and covered by
  `scripts/discover-candidates.test.ts` (15 tests, all passing).

## `#5` Implement pipeline Stages 3-5 (scoring + ranked candidates.csv)

Branch: overnight/2026-10-04/r2-01-t05-scored-candidates-csv

### Decisions

- **Same file as `#4`:** Stages 3-5 live in `scripts/discover-candidates.ts` per the task
  text. The CLI now runs Stages 1-5 in one go; `--from-candidates <json>` skips Stages
  1-2 and scores a previous run's `continuing-candidates.json` (Zod-validated) so a
  re-score never repeats Places API cost. `--concurrency <n>` (default 4).
- **Homepage fetch reuses the crawler's `staticFetch`** (now exported from
  `@modernizer/crawler` along with `StaticFetchResult`). `fetchHomepage` probes https
  first; if that yields nothing it falls back to http and sets `noSsl` unless the http
  fetch redirected back to https. Side effect of reusing `staticFetch`: pages with under
  200 chars of visible text (splash pages, JS-only shells) return null and the candidate
  is reported as unreachable rather than scored. Also, a site whose https fetch fails for
  a non-SSL reason (5xx, thin content) but whose http fetch works is flagged `no_ssl`;
  `staticFetch` returns null for every failure, so the two can't be told apart.
- **Concurrency:** candidates are scored through a small worker pool because PSI takes
  seconds up to ~60s per URL. `createRateLimiter` was not safe under concurrent callers
  (callers in the same tick all woke after one interval), which would have burst
  Wayback past 1 req/sec; fixed in `@modernizer/discovery` by reserving slots
  synchronously. Sequential behavior is unchanged.
- **Wayback lookup URL:** `toWaybackLookupUrl` drops scheme, query string, and a bare
  `/` path, since Places website URIs often carry `?utm_source=...` and Wayback indexes
  by exact URL. Uses the post-redirect URL from the fetch.
- **Unreachable candidates** are excluded from `candidates.csv` (no score to rank) and
  counted in the CLI summary.
- **CSV formatting:** hand-rolled (reuses `#4`'s `csvEscape`/`toCsvRow`, now accepting
  booleans). Scores rounded to one decimal; booleans as `true`/`false`; PSI columns
  empty when PSI is unavailable; `last_changed` empty without Wayback data. `notes`
  appends `staleness: copyright fallback (no Wayback data)` and
  `psi: unavailable, static-only score` where relevant, since a static-only score isn't
  directly comparable to a full one in the same CSV.
- **`url` column** is the Places website as given, not the post-redirect URL.

### Interfaces / exports created (all in `scripts/discover-candidates.ts`)

- `fetchHomepage(website, fetchPage?) => Promise<HomepageFetch | null>`,
  `toWaybackLookupUrl(url)`.
- `scoreCandidate(candidate, options?) => Promise<ScoredCandidate | null>`,
  `scoreCandidates(candidates, options?) => Promise<ScoringResult>` (`{ ranked,
  unreachable }`), `rankCandidates`. `ScoringOptions` takes injectable `fetchPage`,
  `fetchSnapshots`, `fetchPsi`, `now`, plus `concurrency` and `onProgress`.
- `ScoredCandidate` extends `ContinuingCandidate` with `score`, `psiAvailable`,
  `staticScore` (`StaticScoreResult`), `lastChanged`, `stalenessSource`, `psi`. `#6`'s
  `CandidateScore` schema type should model the CSV row (`CANDIDATES_CSV_HEADER`), not
  this in-memory shape.
- `CANDIDATES_CSV_HEADER`, `candidatesToCsv`, `writeCandidatesCsv`,
  `readContinuingCandidates`.

### Deviations from acceptance criteria

- None in what's tested. The full pipeline is covered end to end in
  `scripts/discover-candidates.integration.test.ts` against fabricated fixtures (4 sites
  on an in-process HTTP server, fake Places responses, stubbed Wayback/PSI). No live run
  was done in this session (no `PSI_API_KEY`/`GOOGLE_PLACES_API_KEY` here), so a live
  scoring run is still worth doing before relying on the output.

## `#6` Modernization report consumes the scored CSV

Branch: overnight/2026-10-04/r2-02-t06-scored-report

### Decisions

- **`CandidateScore` lives in `packages/schema/src/candidate-score.ts`** with keys
  matching the `candidates.csv` columns exactly (snake_case, same order as
  `CANDIDATE_SCORE_COLUMNS`), rather than camelCase, so a CSV row maps onto it with no
  renaming. The Zod schema accepts either CSV strings (`'true'`, `'38.5'`, `''` for
  unavailable) or already-typed values. Empty PSI and `last_changed` cells become
  `null`; scores are range-checked 0-100.
- **`parseCandidatesCsv` added to the schema package** (hand-rolled RFC 4180 subset:
  quoted cells, `""` escapes, CRLF). Throws on a header mismatch or an invalid row, with
  the row number. `#7`/`#9` can use it to read `candidates.csv` without another CSV
  dependency.
- **Single column list:** `scripts/discover-candidates.ts`'s `CANDIDATES_CSV_HEADER` is
  now `CANDIDATE_SCORE_COLUMNS` from `@modernizer/schema` (added as a `scripts`
  dependency), so the writer and the contract can't drift.
- **`generateReport(schema, nav, candidateScore?)`:** when a score is given, a
  `## Modernization Score` section renders between `## Source Site` and
  `## What Changed`, with the overall score and threshold verdict (≤40 / 41-60 / 61+ per
  the doc), a sub-score table (static, performance, SEO, accessibility at 25% each),
  the informational PSI composite, a static-signal Yes/No table, staleness, and the
  row's notes. Without a score the output is byte-identical to before (verified against
  main's implementation, ignoring the timestamp).
- **Signal weights are not shown in the report**, only Yes/No, to avoid duplicating
  `@modernizer/discovery`'s `STATIC_SCORE_WEIGHTS` in `generator-local` (no dependency
  between them today). `#7` can add them if the shared report moves somewhere that can
  depend on `discovery`.
- **Not wired to a CLI flag:** `generateSite` still calls `generateReport(schema, nav)`.
  Passing a score through the CLI is left to `#7` (which moves `generateReport` into
  `generator-config` anyway).

### Interfaces / exports created (`@modernizer/schema`)

- `CANDIDATE_SCORE_COLUMNS`, `candidateScoreSchema`, `CandidateScore` type,
  `parseCandidatesCsv(csv) => CandidateScore[]`.

### Deviations from acceptance criteria

- None. Both acceptance cases are covered in
  `packages/generator-local/src/report-generator.test.ts` against a hand-written fixture
  CSV (scored with PSI, static-only without Wayback, and unscored). This is also the
  first test file for the report generator, so the page table and block-count table are
  now covered too, ahead of `#7`.
