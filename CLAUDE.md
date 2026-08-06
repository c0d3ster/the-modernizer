# The Modernizer

CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js + Tailwind CSS applications.

## Full Plan

See `docs/implementation-plan.md` for the complete 7-phase implementation plan with task checklist.

## Current Phase

Phases 1-6 are complete. The pipeline runs end-to-end. Working on **Phase 7: Polish + Edge Cases**.

## Architecture

Three-stage pipeline: **Crawl > Extract > Generate**

- `packages/schema` - Shared TypeScript types + Zod validation (the contract between all layers)
- `packages/ui` - Component library: shadcn/ui primitives + block components (1:1 with ContentBlock types)
- `packages/crawler` - Discovers and fetches all pages on a target site
- `packages/extractor` - Converts raw HTML into structured page schemas using deterministic parsing + LLM classification
- `packages/generator` - Takes structured schemas and outputs a complete Next.js project (used with `--local`)
- `apps/cli` - Command-line entry point that orchestrates the pipeline
- `apps/preview` - Visual test harness for block components

## Conventions

- shadcn/ui for primitives (Button, Card, Badge, etc.) — stored in `packages/ui/src/shadcn/`, copied into output projects
- Block components in `packages/ui/src/blocks/` — one per ContentBlock type, compose shadcn primitives
- Zod validation on all LLM outputs, never trust raw JSON
- All LLM calls use Anthropic tool use API (`callLlmWithTool`) with `thinking: disabled` and low effort for deterministic classification (claude-sonnet-5 rejects non-default `temperature`)
- All styling via Tailwind CSS utility classes, no separate CSS files
- Deterministic approaches first, LLM calls only for ambiguous classification/structuring
- Store LLM prompts as template literal functions in dedicated files under `prompts/`

## Key Test Fixture

The Edgehill Recovery site (https://edgehillrecovery.org/) is the primary test fixture. It's a ~16 page WordPress brochure site. Save crawled HTML locally for repeatable integration tests.

## LLM Usage

Use Anthropic SDK with model `claude-sonnet-5` for all LLM calls. Always validate responses with Zod. Failed blocks fall back to GenericSectionBlock.

## Generation Modes

**Default (Lovable):** Builds a structured prompt from the SiteSchema and opens `https://lovable.dev/?autosubmit=true#prompt=...` in the browser. The user logs into Lovable and the project builds automatically — no API keys or OAuth required. The client gets a Lovable project they can edit via Lovable's no-code UI.

**`--local`:** Runs `@modernizer/generator` to produce a complete Next.js + Tailwind CSS project on disk using pre-built block components.
