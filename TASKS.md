# Modernizer Tasks

Instructions for agent: This file is the task inventory only. Workflow rules (branching, PRs, testing, archival, NEEDS HUMAN annotations) live in CLAUDE.md under "Overnight Agent Workflow". Work through Agent-Ready tasks in order. Do not attempt Decisions items; those require human input.

Spec reference: docs/market-discovery.md defines the discovery pipeline, scoring rubric, and output format. Tasks below reference it by section rather than duplicating the spec. If the doc and this file conflict, the doc wins; annotate the conflict here.

**Annotated conflict (2026-08-06):** the PSI task below previously stated PSI weights of performance 0.5/SEO 0.3/accessibility 0.2 and a final split of static×0.40 + psi×0.60. `docs/market-discovery.md` itself states (twice, consistently) `psi_score = performance×0.30 + seo×0.40 + accessibility×0.30` and `final = static_score×0.50 + psi_score×0.50`. The doc's numbers are authoritative and are what's reflected in the task text below.

## Agent-Ready

- [ ] #1 [stack: discovery] Implement static HTML scoring per docs/market-discovery.md "Sub-score 1: Static HTML". All signals from the weights table (SSL, viewport, old jQuery, old WP theme, table layout, OG tags, IE compat), normalized via the documented formula.
  - New package `packages/discovery` (mirror `packages/crawler`'s scaffold: package.json, tsconfig, eslint, vitest.config, `src/index.ts` barrel). Houses this task plus staleness (#2) and PSI (#3).
  - Files: `src/static-score/signals.ts` (one pure detector per signal), `src/static-score/weights.ts` (shared constants: SSL 20, viewport 20, staleness 20, old jQuery 12, old WP theme 10, table layout 10, no OG 5, IE compat 3), `src/static-score/score.ts` (`computeStaticScore`). No raw-HTML fixtures exist anywhere in the repo yet — hand-author `fixtures/*.html` (an all-signals-firing site and a fully-modern site) for the golden-formula test.
  - SSL detection needs a live fetch, not pure HTML parsing — take it as an injected boolean input rather than computing it from the HTML string.
  - No documented algorithm for "table-based layout" — pick a heuristic (e.g. `<table>` present without `<th>`/`<thead>`/`role="table"`) and document the choice in the PR.
  - Acceptance: unit tests cover each signal firing and not firing; sub-score matches the formula for known fixture HTML; return shape exposes per-signal booleans + a notes string (not just the numeric score), field-named to match the Output Format columns, so #5/#6 can consume it directly.
- [ ] #2 [stack: discovery] Implement staleness detection via Wayback CDX per docs/market-discovery.md "Determining True Last-Updated Date". Use collapse=digest, sliding scale weight min(years × 4, 20), copyright-regex fallback worth 10 when Wayback has no data, 1 req/sec rate limit.
  - Files (in `packages/discovery` from #1): `src/wayback-cdx.ts` (CDX fetch/parse), `src/staleness.ts` (weight calc + copyright fallback), `src/rate-limiter.ts` (1 req/sec gate — no shared rate-limiter exists in the repo yet).
  - Resolve and document: fractional-year rounding for `min(years × 4, 20)`; behavior when only one CDX snapshot exists (no digest change to compare against, so "years since last change" is ambiguous).
  - Acceptance: returns last_changed date and staleness weight for a URL with CDX data; falls back gracefully with none; a test asserts sequential calls are spaced ≥1000ms apart (via a test double/timestamps, not live network calls).
- [ ] #3 [stack: discovery] Implement PSI sub-score per docs/market-discovery.md "Sub-score 2: Lighthouse / PSI". Weighted average: performance 0.30, SEO 0.40, accessibility 0.30. Combine into final score: static × 0.50 + psi × 0.50.
  - Files (in `packages/discovery`): `src/psi-score.ts`, `src/final-score.ts`.
  - Requires PSI API key. If absent, annotate NEEDS HUMAN with the exact env var name (proposed: `PSI_API_KEY`) — resolve consistently with #4's Places key (separate keys vs. one shared `GOOGLE_API_KEY` covering both APIs) rather than deciding independently.
  - Static-only fallback: prefer auto-degrade based on key presence (mirrors the existing `GEMINI_API_KEY` pattern in `packages/generator-claude/src/hero-image.ts`) over introducing a new explicit CLI flag; expose a `psiAvailable: boolean` field in the result rather than throwing.
  - Acceptance: final score computed end to end for a live URL when key is present; unit test that psi_score matches the formula for fixture Lighthouse category scores; Zod-validate the PSI response and define behavior for a malformed/partial result.
- [ ] #4 [stack: discovery] Implement discovery Stages 1-2 per docs/market-discovery.md "Full Programmatic Pipeline": Google Places Text Search per business type (query templates in doc, pagination up to 3 pages), then dedup + filter (no website, review_count < 5 or > 500, known chains).
  - Script location: scripts/discover-candidates.ts per the doc (continued by #5 — same file). `scripts/` isn't currently a pnpm workspace member; decide whether to add it to `pnpm-workspace.yaml` with its own package.json (gets lint/test parity, can depend on `@modernizer/schema`) or keep it an ungoverned root script, and document the choice in the PR.
  - Known-chains detection has no algorithm in the doc beyond two examples (Domino's, Jiffy Lube) — build a starter hardcoded list with case-insensitive substring matching against `name`, documented as a starting point to expand later.
  - No-website candidates route straight to `greenfield-leads.csv` per the doc's Stage 2, using the doc's `greenfield-leads.csv` schema exactly (`business_name, phone, address, city, state, vertical, review_count, rating, place_id`) — keep that output separate from the continuing-candidate list handed to #5.
  - Requires Places API key. If absent, annotate NEEDS HUMAN with the exact env var name (proposed: `GOOGLE_PLACES_API_KEY`) and build against recorded fixtures.
  - Acceptance: given config (city, state, business types), outputs a filtered continuing-candidate list preserving the full Stage 1 record — `name, website, place_id, review_count, phone, address, city, state` — not just the first four fields; downstream `candidates.csv` and the outreach package (#9) need phone/address/city/state too.
- [ ] #5 [stack: discovery] Implement pipeline Stages 3-5: run static scoring (and PSI when available) against candidates, output ranked CSV matching the "Output Format" column spec exactly, sorted by score ascending.
  - Depends on #1-#4 landing first (imports their modules directly). Export `staticFetch` from `packages/crawler/src/index.ts` (currently package-private) for reuse here and by #1's SSL check.
  - No CSV-writing dependency exists anywhere in the repo — add a small one or hand-roll a serializer.
  - No discovery-pipeline fixtures exist (all current repo fixtures are gitignored and built from live runs) — capture a small set (3-5 candidate sites) or fabricate via the in-process-HTTP-server pattern already used in `packages/crawler/src/crawler.integration.test.ts`.
  - Acceptance: full pipeline run against fixtures produces a CSV with all documented columns; sorted by score ascending; top candidates identifiable.
- [ ] #6 [stack: discovery] Refine modernization report logic to consume the scored CSV: per-category breakdown matching the rubric's sub-scores and boolean signals.
  - Blocked on #1-#5 (needs a scored-CSV row shape to render against) — build/test against a small hand-written fixture CSV row rather than waiting on a live pipeline run.
  - Extend `generateReport`'s signature (`packages/generator-local/src/report-generator.ts`) to accept an optional scored-candidate argument; must still render unchanged when no score data is available (existing `--from-schema`/ad-hoc behavior).
  - Add a `CandidateScore` type to `packages/schema` (Zod-validated), matching the Output Format columns exactly, for #5/#7/#9 to share.
  - Acceptance: report renders for a scored candidate with static, PSI, and staleness details; still renders correctly for an unscored candidate (no regression).
- [ ] #7 [stack: discovery] Consolidate `MODERNIZATION_REPORT.md` into a `docs/` folder (matching `generator-claude`'s `docs/design-system.md`), add a before/after score reusing the `docs/market-discovery.md` scoring methodology, and a shareable top-10 bulleted summary; bring `--claude` to parity (it currently has no report at all, confirmed — `generateWithClaude` never writes one today) and keep `generator-local`/`generator-claude` consistent in location/format/scoring (Lovable is explicitly out-of-band, being a hosted third-party platform). Move `generateReport` into `@modernizer/generator-config` as the single shared implementation.
  - Sequenced after #6 (relocates the scoring logic #6 just added, doesn't duplicate it). Change `generateReport`'s signature to accept pre-computed page route/label data instead of importing `generator-local`'s route-mapper, to avoid a reverse package dependency.
  - Output path: `docs/modernization-report.md`, mirroring `generator-claude`'s existing `docs/design-system.md` convention.
  - NEEDS HUMAN: what an "after" score means for freshly generated, undeployed output — PSI needs a live URL, and the static rubric's signals (old WP theme, old jQuery, etc.) don't meaningfully apply to a Next.js/Tailwind output.
  - NEEDS HUMAN: top-10 summary format/audience — proposed default is client-pitch bullets (ties into #9's outreach framing) rather than a technical changelog; confirm.
  - Acceptance (none stated originally — proposed): both `--local` and `--claude` produce `docs/modernization-report.md` with identical section structure and a before/after score block; old `packages/generator-local/src/report-generator.ts` is deleted, not left dangling; unit tests cover the page table, block-count table, and score rendering (no test file exists for this today).
- [ ] #8 [stack: solo] Create CLI command for preview, including a --schema-only flag scoped to score output (see doc "Method 5" note: save schema after a successful crawl, --from-schema for stable fixtures).
  - "Score output" most likely refers to the not-yet-built market-discovery scoring pipeline (#1-#5's candidates.csv), not the existing extractor `--schema-only` flag (which already exists for the SiteSchema, per CLAUDE.md's CLI reference) — this task adds an analogous mechanism scoped to the scoring pipeline instead. Since #1-#5 don't exist yet, treat the score-output scoping as a documented placeholder to revisit later rather than guessing at a CSV schema.
  - Open sub-questions to resolve with sensible defaults and document in the PR: does preview rebuild the home page (proposed default: yes, homepage-only — avoids duplicating the existing full-site `--local` command), and where does output save (proposed default: `.generated/<slug>/preview/`)? `apps/cli` currently has a single implicit command, not subcommands — add `preview` as a Commander subcommand.
  - Acceptance: preview and preview --schema-only both run end to end with documented output location.
- [ ] #9 [stack: discovery] Scaffold lead outreach package with Resend integration for sending modernization reports to leads.
  - Template variables: business name, score, before/after framing. Per docs/market-discovery.md "Notes on Outreach": contractors/trades get "more leads from Google" framing, professional services get "credibility and trust" framing; support per-vertical template variants.
  - New package `packages/outreach` (mirror `packages/generator-config`'s scaffold). The doc only defines 2 framings against 8 target verticals — build a starter vertical→framing mapping and document it as a starting point.
  - Requires Resend API key. If absent, annotate NEEDS HUMAN with the exact env var name (proposed: `RESEND_API_KEY`). Also clarify "test environment": proposed default is Resend's `*.resend.dev` sandbox recipient (no domain verification needed) rather than a verified sending domain + real inbox.
  - Template inputs (business name, score, report data) can be stubbed/hardcoded for this task — true end-to-end wiring to real score/report data depends on #5/#6/#7 landing first.
  - Acceptance: package sends a templated email via Resend in a test environment; deliverability concerns (spam avoidance, subject lines) documented as open items, not solved.

## Research (agent can draft findings, human decides)

- [ ] #10 [stack: solo] Compare/contrast generation results: local generation vs Lovable vs Claude API. Document quality, cost, and speed tradeoffs in docs/research/generation-comparison.md. Do not switch the default pipeline.
  - Existing tooling already covers most of the mechanical work: `pnpm generate-compare` (`scripts/compare-generators.sh`) runs all three modes against the saved Edgehill fixture; `--claude` already prints elapsed time/token counts/dollar cost; `--local` is $0 (no LLM calls, confirmed). Lovable requires manual browser interaction — no programmatic timing/cost readback exists, so wall-clock time and credit cost must be recorded by hand.
  - No `docs/research/` folder exists yet — this task creates it.
- [ ] #11 [stack: solo] Research the shadcn skill for `@modernizer/generator-local` output quality. Evaluate whether it improves component composition, Tailwind idiom quality, or reduces hand-rolled primitives versus the current copy-from-`packages/ui` approach. Document findings (fit, integration effort, tradeoffs vs. the current deterministic template approach) in docs/research/shadcn-skill.md. Do not switch the default generator.

## Decisions (human only, do not attempt)

- [ ] Determine if specialized Claude agents would be useful for the pipeline.
- [ ] Decide email deliverability strategy: spam avoidance approach, per-client customization depth, subject line testing.
- [ ] Decide whether categorization and feature breakdown live in Modernizer or c0d3ster.
- [ ] SerpAPI fallback (doc Method P3, ~$50/mo): only if Places API website coverage proves unreliable. Defer until Stage 1 results are in.

## Discovered
