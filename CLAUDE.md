# The Modernizer

CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Full Plan

See `docs/implementation-plan.md` for the complete 7-phase implementation plan with task checklist.

## Current Phase

Working on **Phase 1: Foundation** (schema types and project scaffolding).

## Architecture

Four-stage pipeline: **Crawl > Extract > Generate > Output**

- `packages/schema` - Shared TypeScript types + Zod validation (the contract between all layers)
- `packages/ui` - Component library following atomic design (atoms/molecules/organisms/templates)
- `packages/crawler` - Discovers and fetches all pages on a target site
- `packages/extractor` - Converts raw HTML into structured page schemas using deterministic parsing + LLM classification
- `packages/generator` - Takes structured schemas and outputs a complete Next.js project
- `apps/cli` - Command-line entry point that orchestrates the pipeline
- `apps/preview` - Visual test harness for the component library

## Conventions

- TypeScript everywhere, strict mode
- Atomic design for components: atoms > molecules > organisms > templates
- Components only import from layers below them (no upward or sideways imports)
- Zod validation on all LLM outputs, never trust raw JSON
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
