# Lead Map: Research

Research for showing discovery results on a map in the c0d3ster site, so a city can be worked in person: walk into the lowest-scoring businesses and the ones with no website. This is the input for a PRD that will likely live in c0d3ster. Nothing here is built yet beyond the coordinates (`latitude`, `longitude` on every lead, PR #39).

Status as of 2026-11-20. Target: usable for the Virginia Beach trip the week of 2026-11-23.

## What exists today

**The Modernizer (this repo)** is a pnpm monorepo of packages plus CLIs. It has no server, database or auth. A discovery run is a local command that writes files:

- `candidates.csv`: every business with a website, scored with the composite (`score`, `pitch` below 81), plus the signal breakdown, vertical, phone, address and now coordinates
- `greenfield-leads.csv`: businesses with no website, with review count, rating and coordinates
- `unreachable.csv`: businesses whose site didn't load (often an even better lead)
- `shots/`: the screenshots behind each visual score

**c0d3ster** is a Next.js 15 app on Vercel: GraphQL (type-graphql + Apollo), a service layer, Drizzle on Neon Postgres, Clerk auth with roles (`client`, `developer`, `admin`, `super_admin`), Cloudflare R2 for files, and GitHub/Vercel provisioning for client projects. It has no leads or map concept yet. Its "project features" (online booking, live chat, reviews) line up with what this repo's browser inspection already detects on a prospect's site (`detectProjectFeatures`), which is a useful bridge later: a lead can arrive with "has booking: no, has reviews widget: yes" already filled in.

## How the two repos could fit together

| Option | What it means | Pros | Cons |
|---|---|---|---|
| **A. Package + push (recommended)** | The Modernizer stays a set of packages and CLIs. A run ends by pushing its results to a c0d3ster ingest endpoint. c0d3ster owns storage, auth, the map and the lead workflow. | One app, one auth, one database. Discovery keeps running locally where Playwright, long PSI calls and Claude costs are easy to control. Clean contract between the repos. | Runs are started from a laptop (or CI), not from the website. |
| B. c0d3ster imports the packages | c0d3ster depends on `@modernizer/discovery` and starts runs itself (button: "scan Virginia Beach"). | Everything from the browser. | A city run takes an hour or more, launches Chromium and spends API money: a poor fit for Vercel functions. Needs a job runner (queue + worker) and publishing the packages. Better as a later step on top of A. |
| C. The Modernizer becomes its own site | A separate app with its own server, database, auth and map. | Clear product boundary if The Modernizer is ever sold on its own. | Second auth system, second database, second deployment, and the lead work (visits, pitches, won clients) still has to reach c0d3ster, where projects and invoices live. The most work for the least gain right now. |
| D. Shared database | The Modernizer writes straight into c0d3ster's Neon tables. | No API to build. | Couples the repos to one schema and one set of credentials; every migration in c0d3ster can break discovery. |

**Recommendation: A now, B later if it earns it.** Keeping The Modernizer as packages matches how it's used (a local, scriptable pipeline) and lets c0d3ster be the one place a lead becomes a client. If running scans from the website becomes worth it, B can be added on top of A without changing the contract: a worker runs the same CLI and pushes to the same endpoint.

## Data contract

A versioned JSON payload per run, defined with zod in `@modernizer/schema` (next to the CSV contract it mirrors) and validated again on the c0d3ster side. c0d3ster can vendor a copy of the zod schema or a generated JSON Schema; publishing the package isn't needed for this.

```ts
interface DiscoveryRunExport {
  version: 1
  runId: string            // e.g. "virginia-beach-va-2026-11-21"
  city: string
  state: string
  ranAt: string            // ISO timestamp
  pitchThreshold: number   // 81 today; stored per run so old runs keep their meaning
  leads: Lead[]
}

interface Lead {
  placeId: string          // stable Google id: the upsert key across runs
  name: string
  kind: 'scored' | 'greenfield' | 'unreachable'
  vertical: string
  phone: string
  address: string
  latitude: number | null
  longitude: number | null
  url: string | null
  reviewCount: number
  rating: number | null
  score: number | null     // composite; null for greenfield and unreachable
  pitch: boolean | null
  signals: {               // the breakdown, for the lead's detail panel and the pitch
    visual: number | null
    staticV2: number | null
    code: number | null
    seo: number | null
    accessibility: number | null
    bestPractices: number | null
    performance: number | null   // not in the score; a talking point
  } | null
  notes: string            // e.g. "no_ssl, copyright 9 years behind"
  screenshotUrl: string | null   // uploaded to R2 on push, optional
}
```

**Push:** `pnpm discover ... --push` (or a separate `pnpm push-run <dir>`) reads the run's CSVs, builds the payload and `POST`s it to a c0d3ster route handler such as `/api/discovery/runs`. A Clerk session is awkward from a CLI, so the route takes a long random API token (`DISCOVERY_INGEST_TOKEN`) checked in the service layer, and the data lands under an admin. A plain route handler is simpler than a GraphQL mutation for a bulk upload and keeps the CLI free of Apollo.

**c0d3ster storage (Drizzle):**

- `discovery_runs`: id, city, state, ran_at, pitch_threshold, counts
- `leads`: place_id (unique), name, kind, vertical, contact fields, lat/lng, latest score and signals, first_seen_run, last_seen_run
- `lead_scores`: lead_id, run_id, score, signals (history, so a re-scan shows whether a site changed)
- `lead_activity`: lead_id, status (`new`, `visited`, `pitched`, `follow_up`, `won`, `not_interested`), note, at, by

Upserting on `place_id` means scanning the same city twice updates leads instead of duplicating them, and keeps your visit notes.

## The map

**Stack:** MapLibre GL JS through `react-map-gl/maplibre`, with free vector tiles (OpenFreeMap needs no key; MapTiler's free tier is an alternative). It clusters thousands of points natively from a GeoJSON source, works well on a phone, and has no per-load billing like Google Maps JS or Mapbox. The page is admin-only (`admin`/`super_admin`), since it lists real businesses with internal scores.

**Color and shape.** Your scheme works with a few changes so it reads at a glance, on a phone in sunlight, and for color-blind viewers (about 1 in 12 men can't tell red from green):

| Lead | Marker | Color | Size |
|---|---|---|---|
| Pitch (score below 81) | Filled circle | Yellow at 80 shading to deep red at the bottom | Bigger as the score drops |
| Greenfield (no website) | Diamond (different shape, not just green) | Green, darker with more reviews | Bigger with more reviews: a busy business with no site is the hottest lead |
| Unreachable site | Hollow ring | Orange outline | Medium |
| Above the threshold | Small dot | Light to mid gray, faded | Small; hidden by default behind a toggle |

Gray-to-white on a light basemap disappears, so above-threshold sites are better as small faded gray dots (or use a dark basemap, where white works). Visit status shows as a small badge on the marker (check for visited, star for won) so the map doubles as a progress view.

**On the phone:**

- "Near me": center on the current location and sort the list by distance
- Tap a marker: name, score, the three biggest problems in plain words, phone (tap to call), "Directions" (opens Google or Apple Maps), and status buttons
- Filters: vertical, score range, kind, status, "not visited yet"
- A list view under the map, sorted by priority, for planning a route

## Coverage in a big city

Google Places Text Search returns at most 60 results per query, and discovery runs one query per business type per city (`"plumber Virginia Beach VA"`). Winchester fits in that cap; Virginia Beach (about 450,000 people) won't, so most businesses would never be found.

Fix before the trip (small change in this repo): split each business type into one query per neighborhood or ZIP code (`"plumber 23451"`, `"plumber Hilltop Virginia Beach"`), dedupe by `place_id` (already done), and stop paging a query early when results run dry. Places also supports a location bias rectangle, so a grid of smaller areas is the more exact version of the same idea.

**Run time and cost** for a city that size, roughly 300 scored sites: PSI dominates wall-clock time (4 at a time), visual scoring adds about $0.03 per site (about $9) with 2 browser inspections at a time, so plan on one to two hours per run. Places requests are about 3 per query, so the ZIP split multiplies them by the number of ZIPs. That's still a modest count, but check the Places pricing tier for the requested fields first.

## Fastest path for next week

1. **This repo (about a day):** ZIP or neighborhood splitting for big cities; the `DiscoveryRunExport` schema and a `push` step (or for the first week, just a `leads.json` file).
2. **c0d3ster (two to three days):** Drizzle tables and migration; the ingest route with the token; an admin `/dashboard/leads` page with the MapLibre map, filters, the detail panel and status buttons.
3. **Run Virginia Beach** before leaving, so the data is ready on the phone.

**Zero-code fallback** if the c0d3ster page isn't ready: Google My Maps imports a CSV with latitude and longitude columns. Import `candidates.csv` (filter to `pitch = true` first) and `greenfield-leads.csv` as two layers, style the first by `score` and the second in a separate color, and open it in the Google Maps app on the phone. No visit tracking, but it works today with the files a run already writes.

## Open questions for the PRD

- Should a lead's visit history follow it into a c0d3ster project when it becomes a client (lead to project request to project)?
- Should c0d3ster store screenshots (R2) or link to them, and is the visual note ("why this site looks dated") shown to the business in a pitch?
- Who else gets access: only you, or developers helping with outreach?
- Re-scan cadence: on demand per city, or periodic to catch sites that got rebuilt by someone else?
- Long term, does "The Modernizer" stay an internal tool behind c0d3ster, or become a product of its own (option C)? Option A keeps that door open, since the packages don't change either way.
