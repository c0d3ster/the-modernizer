# The Modernizer

A CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Philosophy

The goal is **not** to recreate a legacy site pixel-for-pixel. Old layouts are treated as something to **extract from**, not a visual spec to match. The pipeline preserves **information and structure** (what the site says, how pages and navigation are organized) and **re-presents** that content in a consistent design system: typography, spacing, responsive layout, and shared components. When the old presentation is cluttered or dated, the output intentionally **does not** carry it forward.

## How it works

```
Crawl → Extract → Schema JSON → [Lovable MCP via Claude Code | --local]
```

| Stage | Package | Description |
|-------|---------|-------------|
| Crawl | `@modernizer/crawler` | Discovers and fetches all pages on a target site |
| Extract | `@modernizer/extractor` | Converts raw HTML into structured page schemas |
| Generate (default) | Lovable MCP | Claude Code calls Lovable MCP with the schema to create a live project |
| Generate (`--local`) | `@modernizer/generator` | Writes a complete Next.js project to disk |

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

--local            Generate a local Next.js project instead of saving schema for Lovable
--from-schema      Skip crawl/extract, load from a saved schema JSON
--primary-color    Override auto-detected brand color
--max-pages        Max pages to crawl (default: 100)
--output <dir>     Output directory (defaults to .generated/<site-slug>)
```

### Default workflow (Lovable via Claude Code)

1. Run `npx the-modernizer <url>` — crawls, extracts, and saves `schema.json`
2. Claude Code (with [Lovable MCP](https://docs.lovable.dev/integrations/lovable-mcp-server) configured) reads the schema and calls:
   - `list_workspaces` → get workspace ID
   - `create_project` with the schema JSON as `initial_message`
   - `deploy_project` → live URL

Lovable MCP uses OAuth and must be connected through a supported client (Claude Desktop, Claude Code, Cursor, VS Code). See [Lovable MCP setup](https://docs.lovable.dev/integrations/lovable-mcp-server) for connection instructions.

### Local workflow

Use `--local` to skip Lovable and write a full Next.js project to disk:

```
npx the-modernizer <url> --local
cd .generated/<site-slug> && npm install && npm run dev
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
