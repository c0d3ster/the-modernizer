# The Modernizer

A CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Philosophy

The goal is **not** to recreate a legacy site pixel-for-pixel. Old layouts are treated as something to **extract from**, not a visual spec to match. The pipeline preserves **information and structure** (what the site says, how pages and navigation are organized) and **re-presents** that content in a consistent design system: typography, spacing, responsive layout, and shared components. When the old presentation is cluttered or dated, the output intentionally **does not** carry it forward.

## How it works

Four-stage pipeline:

```
Crawl → Extract → Generate → Output
```

| Stage | Package | Description |
|-------|---------|-------------|
| Crawl | `@modernizer/crawler` | Discovers and fetches all pages on a target site |
| Extract | `@modernizer/extractor` | Converts raw HTML into structured page schemas |
| Generate | `@modernizer/generator` | Takes schemas and outputs a complete Next.js project |
| Output | `apps/cli` | CLI entry point that orchestrates the pipeline |

## Packages

| Package | Description |
|---------|-------------|
| `@modernizer/schema` | Shared TypeScript types and Zod schemas (the contract between all layers) |
| `@modernizer/ui` | Component library following atomic design (atoms / molecules / organisms / templates) |
| `@modernizer/crawler` | Site crawler |
| `@modernizer/extractor` | Content extractor |
| `@modernizer/generator` | Site generator |

## Apps

| App | Description |
|-----|-------------|
| `apps/cli` | Command-line entry point |
| `apps/preview` | Visual test harness for the component library |

## Usage

```
npx the-modernizer <url> --output <dir> [options]

--schema-only      Stop after extraction, output SiteSchema JSON only
--from-schema      Skip crawl/extract, generate from saved JSON
--download-assets  Fetch images to local public/ directory
--style            Design preset: clean | minimal | warm | corporate
--primary-color    Override auto-detected brand color
--max-pages        Max pages to crawl (default: 50)
--dry-run          Crawl and report structure without generating
```

## Development

```bash
pnpm install
pnpm dev          # Start all packages in watch mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm check-types  # Type-check all packages
pnpm format       # Format all files with Prettier
```
