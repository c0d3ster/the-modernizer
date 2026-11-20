# The Modernizer

A CLI tool that finds local businesses with outdated websites, scores how good a modernization prospect each one is, then crawls a site, extracts its content, and regenerates it as a modern, responsive Next.js + Tailwind CSS application.

## Philosophy

The goal is **not** to recreate a legacy site pixel-for-pixel. Old layouts are treated as something to **extract from**, not a visual spec to match. The pipeline preserves **information and structure** (what the site says, how pages and navigation are organized) and re-presents that content in a modern design system. When the old presentation is cluttered or dated, the output intentionally does not carry it forward.

## How it works

```
Discover → Crawl → Extract → Schema JSON → Generate
```

| Stage | Package | Description |
|---|---|---|
| Discover | `@modernizer/discovery` | Finds candidate businesses in a city and scores their sites (see [Candidate Scoring](#candidate-scoring)) |
| Crawl | `@modernizer/crawler` | Discovers and fetches all pages on a target site |
| Extract | `@modernizer/extractor` | Converts raw HTML into structured page schemas using deterministic parsing + LLM classification, plus the logo, real photos, hero choice and rendered brand colors |
| Generate | see below | Three generator options depending on use case |

Every generator takes its look from the site's **vertical** (dental, legal, home services, landscaping, restaurant, cafe, auto, chiropractic, veterinary, or general): fonts, neutrals, hero style, the main call to action, header phone and trust signals all come from that vertical's design profile in `@modernizer/design-guide`. The vertical is detected from the content, or set with `--vertical`.

## Generator Modes

| Flag | Package | Description |
|---|---|---|
| _(default)_ or `--lovable` | `@modernizer/generator-lovable` | Builds a prompt from the schema and opens `lovable.dev` in the browser with `?autosubmit=true`. No API key required; the user logs into Lovable and the project builds automatically. |
| `--claude` | `@modernizer/generator-claude` | Writes a complete Next.js project with the Claude API: one call designs the navbar, footer and design system, then one call per page. Needs `ANTHROPIC_API_KEY`; costs roughly $0.50 to $1.80 per site. |
| `--local` | `@modernizer/generator-local` | Writes a complete Next.js project to disk using a deterministic template generator and pre-built block components. No API key required. |

Both on-disk generators share `@modernizer/generator-config`: config files, a theme whose text colors always pass contrast checks, a root layout with Open Graph and Twitter share tags, a monogram favicon, and `next/image` for every remote photo.

## Usage

```bash
pnpm modernize <url> [options]

# Generator flags (default is Lovable)
--lovable             Open Lovable in browser (default)
--claude              Generate with the Claude API (needs ANTHROPIC_API_KEY)
--local               Generate locally via template generator

# Pipeline options
--schema-only         Stop after extraction, write schema.json
--from-schema <file>  Skip crawl/extract, load from a saved schema JSON
--output <dir>        Output directory (defaults to .generated/<site-slug>)
--max-pages <n>       Max pages to crawl (default: 100)
--max-depth <n>       Max crawl depth (default: 3)
--primary-color <hex> Override auto-detected brand color
--vertical <type>     Design profile (dental, legal, home-services, ...) or a business type like "plumber"
--verbose             Detailed logging
```

### Examples

```bash
# Lovable (default): opens browser, builds automatically
pnpm modernize https://example.com

# Local template: no API key needed
pnpm modernize https://example.com --local --output .generated/example

# Claude API, with an explicit design profile
pnpm modernize https://example.com --claude --vertical dental --output .generated/example-claude

# Save schema only, generate later
pnpm modernize https://example.com --schema-only --output ./fixtures
pnpm modernize --from-schema ./fixtures/schema.json --local --output .generated/example
```

## Comparing Generators

Use `pnpm generate-compare` to run all generators against the same schema and compare outputs side by side. This is the recommended way to evaluate quality differences before pitching to a client.

```bash
pnpm generate-compare [-- path/to/schema.json]
```

Default schema: `packages/extractor/fixtures/edgehill-wayback-2026.json`

### Setting up the test fixture

The fixture is a frozen Wayback Machine snapshot of a pre-modernization site, so results are consistent and reproducible regardless of what happens to the live site.

```bash
# Crawl the snapshot once and save the schema
pnpm modernize "https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/" \
  --schema-only --max-pages 20 --output packages/extractor/fixtures

mv packages/extractor/fixtures/schema.json \
   packages/extractor/fixtures/edgehill-wayback-2026.json

# Run the comparison
pnpm generate-compare
```

Outputs:
- `.generated/edgehill-local`: local template output (`npm install && npm run dev`)
- Lovable: opens in browser automatically

## Candidate Scoring

Scores work like Lighthouse: 100 = perfectly modern, 0 = completely outdated, and **lower is a better prospect**. The score combines six signals, each 0-100:

```
score = visual × 0.5
      + static_v2 × 0.1
      + build_quality × 0.1
      + seo × 0.1
      + accessibility × 0.1
      + best_practices × 0.1
```

**Pitch a business when its score is below 81.**

| Signal | Where it comes from | Needs |
|---|---|---|
| Visual design | A headless browser screenshots the homepage at laptop, phone and small-laptop sizes; Claude scores the screenshots against the design rubric in `@modernizer/design-guide`, and the 100-point score is computed in code from the rule deductions. About $0.03 per site. | `ANTHROPIC_API_KEY` |
| Static HTML v2 | Years since the copyright year, no responsive images (`srcset`), and inline style count | nothing |
| Build quality | Five Lighthouse audits: legacy JavaScript, font loading, duplicate JavaScript, script startup time, unsized images | `PSI_API_KEY` |
| SEO, accessibility, Best Practices | Lighthouse categories from Google PageSpeed Insights (mobile) | `PSI_API_KEY` |

A signal that can't run (no key, a failed PSI call, a site that blocks the browser) drops out and the others are reweighted to fill its share, so the score stays on the same scale. The `notes` column says which signals were left out.

Raw Lighthouse performance and the original static checks (no HTTPS, no viewport, old jQuery, old WordPress theme, table layouts, Wayback staleness) are still reported as talking points but don't count toward the score. On the 47-site hand-rated bench they didn't predict which sites were worth pitching (raw performance even pointed the wrong way, since polished sites carry video and big photos); the composite above matched the hand ratings far better. The weights and cutoff live in `@modernizer/schema` (`COMPOSITE_WEIGHTS`, `PITCH_THRESHOLD`). Full rubric, evidence and rationale: `docs/market-discovery.md`.

### Score one site

```bash
pnpm score <url>               # full breakdown
pnpm score <url> --no-visual   # skip the browser and Claude cost
```

### Find and score a whole city

```bash
cd scripts
pnpm discover --city Winchester --state VA --out-dir ../leads/winchester
```

This runs Google Places search (needs `GOOGLE_PLACES_API_KEY`), filters out chains and businesses with too few or too many reviews, then scores every candidate with a website. It writes:

- `candidates.csv`: scored businesses, lowest score first, with a `pitch` column
- `greenfield-leads.csv`: businesses with no website at all (a new build rather than a modernization)
- `continuing-candidates.json`: the scoring input, so `--from-candidates <file>` can re-score without repeating the Places search
- `shots/`: the screenshots behind each visual score

Add `--no-visual` to skip visual scoring, and `--concurrency <n>` to change how many sites are scored at once (default 4; browser inspections are capped at 2 at a time). PSI runs a full Lighthouse audit per URL, which can take several seconds up to about 60s for a complex page, so a city of 100+ candidates takes a while.

## Environment

Put keys in `.env` at the repo root; the CLIs load it automatically.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `--claude`, extraction, visual scoring | Without it, visual scoring is skipped |
| `PSI_API_KEY` | Candidate scoring | Google Cloud key with the PageSpeed Insights API enabled; free up to 25,000 queries/day |
| `GOOGLE_PLACES_API_KEY` | `pnpm discover` without `--from-candidates` | Places API (New) |
| `MODERNIZER_CHROMIUM_PATH` | Visual scoring | Only needed when Playwright's expected Chromium build isn't installed; `pnpm --filter @modernizer/discovery exec playwright install chromium` installs it |

## Packages

| Package | Description |
|---|---|
| `@modernizer/schema` | Shared TypeScript types and Zod schemas: the contract between all layers, including the `candidates.csv` columns and the score weights |
| `@modernizer/crawler` | Site crawler |
| `@modernizer/extractor` | Content extractor |
| `@modernizer/design-guide` | Design rules, the 100-point visual rubric, and per-vertical design profiles (fonts, neutrals, hero, main action) used by both the visual scorer and the generators |
| `@modernizer/discovery` | Candidate scoring: static checks, PSI, headless-browser inspection, the visual scorer, and the composite |
| `@modernizer/generator-lovable` | Lovable Build-with-URL generator |
| `@modernizer/generator-claude` | Claude API generator |
| `@modernizer/generator-local` | Deterministic template generator |
| `@modernizer/generator-config` | Config, theme, layout metadata and favicon shared by the on-disk generators |
| `@modernizer/ui` | Block component library (shadcn/ui primitives + layout components) |

## Apps

| App | Description |
|---|---|
| `apps/cli` | Command-line entry point (`pnpm modernize`) |
| `apps/preview` | Visual test harness for block components |
| `apps/discovery-cli` | Scores a single candidate URL (`pnpm score <url>`) |

## Scripts

Run from `scripts/` with `node --env-file-if-exists=../.env --import tsx <script>` (or the package scripts where listed).

| Script | What it does |
|---|---|
| `discover-candidates.ts` (`pnpm discover`) | Market-discovery pipeline: Places search, filtering, scoring, CSV output |
| `score-sites.ts` | Inspects and visually scores any list of `name=url` pairs, e.g. reference sites or generated sites served locally. Writes screenshots and scores under `--out` |
| `eval-visual-score.ts` (`pnpm eval:visual`) | Runs the visual scorer over the hand-rated bench and reports agreement with the hand ratings |
| `fit-rule-points.ts` | Fits the rubric's point values to the hand ratings from recorded findings (no API calls) |
| `remeasure-eval-set.ts` | Adds newer browser measurements to a saved eval set without retaking screenshots |

## Development

```bash
pnpm install
pnpm dev           # Start all packages in watch mode
pnpm build         # Build all packages
pnpm lint          # Lint all packages
pnpm check-types   # Type-check all packages
pnpm test          # Run tests
pnpm format        # Format all files with Prettier
pnpm generate-compare  # Run all generators against the fixture schema
```
