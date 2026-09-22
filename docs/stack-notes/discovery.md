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
- **Place Details deferred until after Stage 2 filtering, for both output branches:** per
  the doc's optimization note, `formatted_phone_number`/`formatted_address` (Details-only
  fields per this doc) are fetched only for records that survive routing — both
  greenfield and continuing — never for dropped (chain/review-count) records.
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
  (2000ms, matching Google's documented `next_page_token` activation delay) rather than
  duplicating that logic — added `@modernizer/discovery` as a dependency of `scripts`.
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
  `scripts/discover-candidates.test.ts` — matching the fields the doc specifies Text
  Search / Place Details return) via the injectable `fetchImpl` option. Flagged as `NEEDS
  HUMAN` in TASKS.md/PR: set `GOOGLE_PLACES_API_KEY` (a Google Cloud API key with the
  Places API enabled) and run `pnpm discover-candidates --city <city> --state <state>`
  against real data to confirm the response shapes this task assumed (e.g., whether Text
  Search actually returns `website` directly, per the doc, vs. requiring a Details call
  like `formatted_phone_number`/`formatted_address` do) hold against the live API.
- All other acceptance criteria — filtered continuing-candidate list preserving the full
  Stage 1 record, separate `greenfield-leads.csv` with the doc's exact schema, pagination
  capped at 3 pages, dedup, known-chain starter list — are implemented and covered by
  `scripts/discover-candidates.test.ts` (15 tests, all passing).
