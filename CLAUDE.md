# The Modernizer

CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Full Plan

See `docs/implementation-plan.md` for the complete 7-phase implementation plan with task checklist.

## Current Phase

Working on **Phase 4: Component Library** (shadcn/ui primitives + block components).

## Architecture

Four-stage pipeline: **Crawl > Extract > Generate > Output**

- `packages/schema` - Shared TypeScript types + Zod validation (the contract between all layers)
- `packages/ui` - Component library: shadcn/ui primitives + block components (1:1 with ContentBlock types)
- `packages/crawler` - Discovers and fetches all pages on a target site
- `packages/extractor` - Converts raw HTML into structured page schemas using deterministic parsing + LLM classification
- `packages/generator` - Takes structured schemas and outputs a complete Next.js project
- `apps/cli` - Command-line entry point that orchestrates the pipeline
- `apps/preview` - Visual test harness for block components

## Conventions

- TypeScript everywhere, strict mode
- shadcn/ui for primitives (Button, Card, Badge, etc.) — stored in `packages/ui/src/shadcn/`, copied into output projects
- Block components in `packages/ui/src/blocks/` — one per ContentBlock type, compose shadcn primitives
- Zod validation on all LLM outputs, never trust raw JSON
- All LLM calls use Anthropic tool use API (`callLlmWithTool`) with `temperature: 0`
- Vitest for testing
- All styling via Tailwind CSS utility classes, no separate CSS files
- Deterministic approaches first, LLM calls only for ambiguous classification/structuring
- Store LLM prompts as template literal functions in dedicated files under `prompts/`

## Key Test Fixture

The Edgehill Recovery site (https://edgehillrecovery.org/) is the primary test fixture. It's a ~16 page WordPress brochure site. Save crawled HTML locally for repeatable integration tests.

## LLM Usage

Use Anthropic SDK with model `claude-sonnet-4-20250514` for all LLM calls. Always validate responses with Zod. Failed blocks fall back to GenericSectionBlock.

## CLI Quick Reference

```
npx the-modernizer <url> --output <dir> [options]

--schema-only    Stop after extraction, output SiteSchema JSON only
--from-schema    Skip crawl/extract, generate from saved JSON
--download-assets  Fetch images to local public/ directory
--style          Design preset: clean | minimal | warm | corporate
--primary-color  Override auto-detected brand color
--max-pages      Max pages to crawl (default: 50)
--dry-run        Crawl and report structure without generating
```
