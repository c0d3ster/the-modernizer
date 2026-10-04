# Modernizer Tasks

Instructions for agent: This file is the task inventory only. Workflow rules (branching, PRs, testing, archival, NEEDS HUMAN annotations) live in CLAUDE.md under "Overnight Agent Workflow". Work through Agent-Ready tasks in order. Do not attempt Decisions items; those require human input.

Spec reference: docs/market-discovery.md defines the discovery pipeline, scoring rubric, and output format. Tasks below reference it by section rather than duplicating the spec. If the doc and this file conflict, the doc wins; annotate the conflict here.

## Agent-Ready

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

- [ ] `old_wp_theme` only catches WordPress's own year-named default themes (`twentyten`-`twentynineteen`). Confirmed via live Wayback testing: the 2018 `edgehillrecovery.org` snapshot runs a Genesis child theme (`serenity`) and scores 80 with `old_wp_theme` not firing, despite clearly dated markup (no viewport) — most small-business WP sites run a premium/marketplace theme (Genesis, Divi, Avada, Astra, Elementor), not a WP default, so this signal systematically under-flags the tool's actual target audience. A per-framework version→year lookup (e.g. parsing Genesis's `?ver=` query string) doesn't generalize and needs maintaining per vendor. Higher-leverage alternative: detect stale WordPress *core* version via `<meta name="generator" content="WordPress X.X">` (when present, not stripped) — one signal, no per-theme-vendor table, catches old installs regardless of theme. Needs a weights-table update in `docs/market-discovery.md` if added (`old_wp_theme` weight of 10 would need to be reconsidered or split).
- [ ] Three checks fail on main independent of any task: `@modernizer/extractor#test` and `@modernizer/generator-config#test` exit 1 because `vitest run` finds no test files (add `passWithNoTests` or a first test), and `@modernizer/generator-lovable#lint` fails because the package has no ESLint flat config. Found running the full suite for `#5`/`#6`.
- [ ] `apps/discovery-cli` (`pnpm score <url>`) still computes static score only, with staleness stubbed at 0 and no PSI, and its output text still describes the old 50/50 formula, while README's "Candidate Scoring" section says it computes the full four-part final score. Could reuse `scoreCandidate` from `scripts/discover-candidates.ts`. Found while implementing `#5`.
- [ ] Discovery scoring reuses the crawler's `staticFetch`, which returns null for pages under 200 chars of visible text, so splash pages and JS-only shells are reported unreachable instead of scored, and an https failure for a non-SSL reason (5xx, thin page) gets flagged `no_ssl` when http works. Splash-page sites are likely good prospects. Found while implementing `#5` (see `docs/stack-notes/discovery.md`).
