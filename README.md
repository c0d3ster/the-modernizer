# The Modernizer

A CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Philosophy

The goal is **not** to recreate a legacy site pixel-for-pixel. Old layouts are treated as something to **extract from**, not a visual spec to match. The pipeline preserves **information and structure** (what the site says, how pages and navigation are organized) and **re-presents** that content in a consistent design system: typography, spacing, responsive layout, and shared components. When the old presentation is cluttered or dated, the output intentionally **does not** carry it forward.

## How it works

Four-stage pipeline:

```
Crawl → Extract → Schema JSON → Generate
```

| Stage | Package | Description |
|-------|---------|-------------|
| Crawl | `@modernizer/crawler` | Discovers and fetches all pages on a target site |
| Extract | `@modernizer/extractor` | Converts raw HTML into structured page schemas |
| Generate (default) | Lovable MCP | Sends the schema JSON to Lovable and returns a live project URL |
| Generate (local) | `@modernizer/generator` | Writes a complete Next.js project to disk (`--local` flag) |

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
npx the-modernizer <url> [options]

--local            Generate a local Next.js project instead of creating a Lovable project
--schema-only      Stop after extraction, output SiteSchema JSON only
--from-schema      Skip crawl/extract, generate from saved JSON
--primary-color    Override auto-detected brand color
--max-pages        Max pages to crawl (default: 100)
--output <dir>     Output directory (local mode only, defaults to .generated/<site-slug>)
```

### Lovable setup

By default the CLI creates a project on [Lovable](https://lovable.dev) and returns a live URL. Authentication uses OAuth — on first run a browser window opens for you to authorize. Tokens are stored in `~/.config/the-modernizer/lovable-auth.json`.

Optionally override the MCP server URL via env var (defaults to `https://mcp.lovable.dev/sse`):

```
LOVABLE_MCP_URL=https://mcp.lovable.dev/sse
```

Use `--local` to skip Lovable and write a Next.js project to disk instead.

## Development

```bash
pnpm install
pnpm dev          # Start all packages in watch mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm check-types  # Type-check all packages
pnpm format       # Format all files with Prettier
```
