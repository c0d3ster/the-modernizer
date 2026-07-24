# The Modernizer

A CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Philosophy

The goal is **not** to recreate a legacy site pixel-for-pixel. Old layouts are treated as something to **extract from**, not a visual spec to match. The pipeline preserves **information and structure** — what the site says, how pages and navigation are organized — and re-presents that content in a modern design system. When the old presentation is cluttered or dated, the output intentionally does not carry it forward.

## How it works

```
Crawl → Extract → Schema JSON → Generate
```

| Stage | Package | Description |
|---|---|---|
| Crawl | `@modernizer/crawler` | Discovers and fetches all pages on a target site |
| Extract | `@modernizer/extractor` | Converts raw HTML into structured page schemas using deterministic parsing + LLM classification |
| Generate | see below | Two generator options depending on use case |

## Generator Modes

| Flag | Package | Description |
|---|---|---|
| _(default)_ or `--lovable` | `@modernizer/generator-lovable` | Builds a prompt from the schema and opens `lovable.dev` in the browser with `?autosubmit=true`. No API key required — the user logs into Lovable and the project builds automatically. |
| `--local` | `@modernizer/generator-local` | Writes a complete Next.js project to disk using a deterministic template generator and pre-built block components. No API key required. |

## Usage

```bash
pnpm modernize <url> [options]

# Generator flags (default is Lovable)
--lovable            Open Lovable in browser (default)
--local              Generate locally via template generator

# Pipeline options
--schema-only        Stop after extraction, write schema.json
--from-schema <file> Skip crawl/extract, load from a saved schema JSON
--output <dir>       Output directory (defaults to .generated/<site-slug>)
--max-pages <n>      Max pages to crawl (default: 100)
--max-depth <n>      Max crawl depth (default: 3)
--primary-color <hex> Override auto-detected brand color
--headless           Use headless Chromium (for CI/Docker)
--verbose            Detailed logging
```

### Examples

```bash
# Lovable (default) — opens browser, builds automatically
pnpm modernize https://example.com

# Local template — no API key needed
pnpm modernize https://example.com --local --output .generated/example

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
- `.generated/edgehill-local` — local template output (`npm install && npm run dev`)
- Lovable — opens in browser automatically

## Packages

| Package | Description |
|---|---|
| `@modernizer/schema` | Shared TypeScript types and Zod schemas — the contract between all layers |
| `@modernizer/crawler` | Site crawler |
| `@modernizer/extractor` | Content extractor |
| `@modernizer/generator-lovable` | Lovable Build-with-URL generator |
| `@modernizer/generator-local` | Deterministic template generator |
| `@modernizer/ui` | Block component library (shadcn/ui primitives + layout components) |

## Apps

| App | Description |
|---|---|
| `apps/cli` | Command-line entry point |
| `apps/preview` | Visual test harness for block components |

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
