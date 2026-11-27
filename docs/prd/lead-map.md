# PRD: Lead Map (the-modernizer side)

Status: draft, 2026-11-27. The full PRD lives in c0d3ster: [`docs/prd/lead-map.md`](https://github.com/c0d3ster/c0d3ster/blob/main/docs/prd/lead-map.md). This doc holds only the modernizer's part, so `/discover-tasks --scan` in this repo finds it. The design background is in [`docs/lead-map-research.md`](../lead-map-research.md).

## Goal

The modernizer finds and scores local businesses (discovery, composite score, coordinates: all merged) and hands each run to c0d3ster, which shows the leads on an admin map. This repo's part: better coverage of large cities, a coverage report per run, skipping leads already scored or visited, and the push to c0d3ster.

## Contract with c0d3ster

- **Ingest:** `pnpm push-run <dir>` builds a `DiscoveryRunExport` (zod, `@modernizer/schema`, version 1) from a run's output and POSTs it to `<C0D3STER_URL>/api/discovery/runs` with `Authorization: Bearer <DISCOVERY_INGEST_TOKEN>`. Leads are matched on Google's `place_id`.
- **Known leads:** `POST <C0D3STER_URL>/api/discovery/known` with the same token and `{ placeIds: string[] }` (max 500 per call). The response lists only the ids c0d3ster already has, each with `lastScoredAt`, `score` and `status`.
- **Skip rule:** a known lead is not re-scored when its `status` is anything but `new`, or it was scored within `--rescore-after` days (default 90). `--rescore` forces a full re-score. Skipped leads count as `skipped_known_count`.
- **Offline fallback:** `--skip-seen <dir...>` applies the same skip against earlier runs' output folders.

## Run coverage

Places Text Search returns no total count. A run reports instead:

- **Truncated queries:** a query that still has a `nextPageToken` after its third page (60 results) has more results than it returned. Listed per run; any listed query needs a finer split.
- **Funnel counts:** found, after dedupe, filtered (chains and review-count bounds), skipped as known, scored, unreachable, pitch. Printed at the end of the run, written to `run-summary.json`, and included in `DiscoveryRunExport`.

## Milestones

Stacks: `discovery: M1 -> M2 -> M3`, `handoff: M4 -> M5`, `solo: M6, M7`.

**M1: ZIP or neighborhood split.** A city config with ZIPs (or neighborhoods) runs one query per vertical per area, dedupes by `place_id`, and stops paging when a page is empty. Acceptance: tests with mocked Places pages cover the split, dedupe across areas, and an empty page.

**M2: Run coverage report.** Each query records whether it hit the 60-result cap; the run prints the funnel counts and truncated queries and writes `run-summary.json`. Acceptance: tests with mocked Places pages, including a truncated query.

**M3: Skip known leads, local.** `--skip-seen <dir...>` drops `place_id`s found in earlier runs' output before scoring, and reports the skipped count. Acceptance: tests with fixture run directories.

**M4: `DiscoveryRunExport` schema and `push-run`.** Zod schema v1 in `@modernizer/schema`, including the coverage counts; `pnpm push-run <dir>` builds it from a run's output and POSTs it with the token; `--dry-run` writes `leads.json` instead. Acceptance: schema tests, and `push-run` tests with a mocked fetch for success, 401 and 400.

**M5: Skip known leads via c0d3ster.** With `C0D3STER_URL` and the token set, known leads come from `/api/discovery/known` (batched by 500) and the skip rule applies (`--rescore-after`, `--rescore`); falls back to `--skip-seen` when unset or unreachable. Depends on M3, M4, and c0d3ster's known-leads route (c0d3ster PRD issue 3a). Acceptance: tests with a mocked fetch.

**M6: CI.** A GitHub Actions workflow runs `pnpm check-types`, `pnpm lint` and `pnpm test` on pull requests and pushes to main. The repo has no CI today. Acceptance: the workflow passes on main.

**M7: Verify Places API pricing (research).** Update `docs/market-discovery.md` with the current Places API (New) Text Search price and free usage, with a source link, and an estimated cost for a ZIP-split Virginia Beach run. The current figures likely predate Google's March 2025 pricing change.

## Open questions

1. ZIP list source: a hand-maintained config per city, or derived from a public ZIP dataset?
2. Where `C0D3STER_URL` and `DISCOVERY_INGEST_TOKEN` live locally (`.env` at the repo root, matching the CLI's other keys?).
