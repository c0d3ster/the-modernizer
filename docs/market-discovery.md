# Market Discovery: Finding Sites to Modernize

A guide for identifying small businesses with outdated websites that are likely to pay for a modernization. Methods are ordered from lowest to highest effort. Each method is self-contained — work through them one at a time to gauge yield before investing in the next.

---

## Target Profile

The ideal client has all of the following:

- **Revenue-generating business** — not a hobby project or personal site
- **Outdated website** — looks like it was built before 2018, poor mobile experience
- **No in-house dev** — the owner or office manager updates it themselves (or never does)
- **Cares about appearance** — serves customers who judge them before calling

---

## Target Verticals

Listed by how often their sites are neglected and how likely they are to pay:

| Vertical | Neglect Rate | Budget | Notes |
|---|---|---|---|
| Restaurants | High | Medium | Visual product, owners care about first impressions |
| Plumbers / HVAC / Electricians | Very High | Medium-High | Leads = revenue, simple sites |
| Dental / Chiro / Optometry | High | High | Professional image matters, marketing budget exists |
| Auto body / Mechanic | Very High | Medium | Often sole proprietor, site untouched for years |
| Law firms (solo/small) | High | High | Credibility-dependent, slow to modernize |
| Funeral homes | Very High | Medium | Conservative but image-conscious |
| Yoga / Pilates / CrossFit studios | Medium | Medium | Visual product, often bootstrapped |
| Veterinary clinics | High | Medium-High | Local monopoly-ish, loyal clients, neglected sites |

---

## Manual Discovery Methods

Try these one at a time. Stop adding methods once you have 20+ viable candidates.

### Method 1 — Local restaurant search (start here)

Search Google Maps for restaurants in your city. Open each site that appears in results. Skip anything that looks modern (Squarespace, Wix, or a clean responsive layout). Zero tooling required.

**What to look for:**
- Site built before 2018 (check footer copyright or design era)
- Not mobile-friendly (load it on your phone)
- Flash-era navigation, large background images that don't scale, horizontal scroll on mobile
- Generic "Welcome to [Name]!" homepage copy

**Steps:**
1. Open Google Maps
2. Search "restaurants [your city]"
3. Click each business, open their website
4. Score it (see Scoring section below)
5. Record any that score 60+

**Expected yield:** 3-5 viable candidates per 20 sites checked.

---

### Method 2 — Google Maps by vertical

Same as Method 1 but targeting higher-value verticals where modernization ROI is easier to explain.

**Steps:**
1. Search `[vertical] [your city]` on Google Maps (e.g. "plumber Austin")
2. Prioritize listings with 10-50 reviews (established, not huge)
3. Avoid chains and franchises — no local decision-making authority
4. Open site, score it

**Recommended searches in order:**
- `plumber [city]`
- `hvac [city]`
- `auto body [city]`
- `chiropractor [city]`
- `family dentist [city]`
- `personal injury lawyer [city]`

---

### Method 3 — Google search with age indicators

Search for outdated sites using signals that indicate an old build.

**Queries to try:**
- `"welcome to" "[city]" [vertical] site:.com`
- `"powered by wordpress" "[city]" plumber`
- `"© 2015" OR "© 2016" OR "© 2017" [city] dentist`
- `[vertical] [city] inurl:index.php`

**Notes:**
- Copyright year filtering is noisy but surfaces gems
- `inurl:index.php` catches pre-WordPress PHP sites

---

### Method 4 — Local directories

Older directories list businesses that haven't migrated to Google-first presence.

**Directories to check:**
- yellowpages.com — search by vertical and city, filter to listings with websites
- chamberofcommerce.com — chamber member links are often years-old and unmaintained
- Local city `.gov` or `.org` business directories

---

### Method 5 — Wayback Machine prospecting

Best for **test fixtures** rather than finding new prospects. After a successful crawl, save the schema with `--schema-only` and use `--from-schema` on subsequent runs — the fixture never changes.

To find candidates: a Wayback Machine CDX API query can surface sites that haven't been re-crawled in years, indicating they haven't changed. This is a strong staleness signal.

---

## Programmatic Discovery Methods

These replace the manual Google Maps browsing with API calls. They require API keys and produce a list of URLs that feed directly into the scoring pipeline.

### Method P1 — Google Places API (recommended)

The most direct path: search by business type and location, get a list of businesses with their website URLs.

**API used:** Google Places Text Search or Nearby Search
**Cost:** ~$0.017 per request, $200/month free credit (enough for thousands of queries)
**Requires:** Google Cloud project with Places API enabled

**Endpoint:**
```
GET https://maps.googleapis.com/maps/api/place/textsearch/json
  ?query=plumber+austin+tx
  &key=YOUR_KEY
```

**Response fields to extract:**
- `results[].website` — the business URL to score
- `results[].name` — business name for output
- `results[].user_ratings_total` — filter to 10-200 reviews (active but small)
- `results[].rating` — optional, not strongly correlated with site quality

**Pagination:** Each response returns up to 20 results with a `next_page_token`. Request up to 3 pages (60 results) per query.

**Query templates to run programmatically:**
```
restaurant [city] [state]
plumber [city] [state]
hvac contractor [city] [state]
auto body shop [city] [state]
chiropractor [city] [state]
dentist [city] [state]
personal injury attorney [city] [state]
veterinarian [city] [state]
```

---

### Method P2 — Yelp Fusion API

Alternative/complement to Google Places. Yelp has strong coverage of restaurants and local services.

**API used:** Yelp Business Search
**Cost:** Free tier — 500 requests/day
**Requires:** Yelp developer account

**Endpoint:**
```
GET https://api.yelp.com/v3/businesses/search
  ?term=plumber
  &location=Austin, TX
  &limit=50
Authorization: Bearer YOUR_API_KEY
```

**Response fields to extract:**
- `businesses[].url` — Yelp listing URL (need to follow to get actual website)
- `businesses[].website` — direct website URL (not always present)

**Note:** Yelp doesn't always return the business's own website URL in the API response. You may need to scrape the Yelp listing page for the external website link. This adds complexity — try Google Places first.

---

### Method P3 — SerpAPI (Google Maps results without official API)

SerpAPI proxies Google Maps search results programmatically. More expensive than Places API but requires no Google Cloud setup.

**Cost:** ~$50/month for 5,000 searches
**Use case:** If Places API isn't returning website URLs reliably, SerpAPI returns the full Maps result including the website link field.

---

### Full Programmatic Pipeline

```
Config: city, state, business types[], API keys
  ↓
Stage 1 — Discovery (Google Places API per business type)
  → outputs: [{name, website, place_id, review_count}]
  ↓
Stage 2 — Dedup + filter
  → drop: no website, review_count < 5 or > 500, chains (Domino's, Jiffy Lube, etc.)
  ↓
Stage 3 — HTML fetch + static scoring
  → fetch homepage HTML (plain GET, no JS)
  → score against static signals (viewport, copyright, WP theme, OG tags, tables, SSL)
  ↓
Stage 4 — Lighthouse / PSI scoring (optional, slower)
  → call PSI API for mobile performance score
  → adds ~2s per URL
  ↓
Stage 5 — Output ranked CSV
  → sort by score ascending (lowest = best prospect)
  → top 20 feed directly into the modernizer pipeline
```

**Suggested script location:** `scripts/discover-candidates.ts`

**Estimated run time:** ~5 min for 200 URLs (mostly PSI API latency). Skip PSI on first pass, add it for top candidates only.

---

## Site Scoring Rubric

Scores work like Lighthouse: **100 = perfectly modern site**, **0 = completely outdated**. Lower scores are better prospects.

Scoring uses **two independent automated sub-scores** combined into a weighted final score. Each sub-score is normalized to 0-100 within its own category, so the total can never go out of range. All signals are fully automated — no human review step, making results consistent across runs.

### Final score formula

```
final = (static_score × 0.40) + (psi_score × 0.60)
```

**Thresholds:**
- **≤ 40** — strong candidate, clear visual case for modernization
- **41-60** — moderate candidate, worth a closer look
- **61+** — already modern enough that a pitch is hard to make

---

### Sub-score 1: Static HTML (40% weight)

Fast checks against raw HTML — no browser, no API key. Each signal has a weight. The sub-score is calculated as:

```
static_score = 100 × (1 − fired_weight / total_weight)
```

Total weight across all signals = 100. Signals that don't fire contribute 0.

| Signal | Weight | Detection method |
|---|---|---|
| No HTTPS / expired SSL | 22 | `https://` fetch fails or cert error |
| No viewport meta tag | 22 | `<meta name="viewport">` absent |
| Last content change > 3 years (Wayback) | 20 | CDX digest comparison — see Wayback section |
| Last content change 2-3 years (Wayback) | 10 | Same method, less severe (use one or the other) |
| WordPress with old default theme | 12 | `/wp-content/themes/(twentytwelve\|...\|twentyseventeen)/` in source |
| Table-based layout | 10 | `<table>` in non-data context |
| No Open Graph tags | 8 | `<meta property="og:` absent |
| Page weight > 3MB | 4 | Response body size |
| Copyright year < 2020 | 2 | Regex `©\s*(20(0[0-9]\|1[0-9]))` — weak, auto-updated by most CMS |

> Note: Wayback signals are mutually exclusive — only the stronger one fires. Maximum static penalty from stacking all other signals: 58 points, leaving a floor well above 0.

---

### Sub-score 2: Lighthouse / PSI (60% weight)

Lighthouse is the open-source audit engine built into Chrome DevTools (Lighthouse tab). The PageSpeed Insights API runs the same engine server-side — no browser required, just an HTTP call.

**For automated scoring:**

```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url=https://example.com
  &strategy=mobile
  &key=YOUR_KEY
```

**Key response fields:**
- `lighthouseResult.categories.performance.score` — multiply by 100
- `lighthouseResult.categories.seo.score` — multiply by 100
- `lighthouseResult.categories.accessibility.score` — multiply by 100

**PSI sub-score formula** — weighted average of three Lighthouse categories:

```
psi_score = (performance × 0.5) + (seo × 0.3) + (accessibility × 0.2)
```

All three are already 0-100, so the result is always in range.

**Cost:** Free with a Google Cloud API key. Rate limit: 25,000 queries/day.

---

## Determining True Last-Updated Date via Wayback Machine

Copyright years are unreliable — WordPress and most CMS platforms auto-update them in the footer. The Wayback Machine CDX API is a better signal: it stores a content hash (`digest`) with each snapshot. When the digest stops changing between snapshots, the site stopped being updated.

**CDX API endpoint:**
```
GET https://web.archive.org/cdx/search/cdx
  ?url=example.com
  &output=json
  &fl=timestamp,digest
  &limit=50
  &from=20150101
  &collapse=digest
```

The `collapse=digest` parameter is the key: it returns only the first snapshot for each unique digest value, effectively giving you a list of every time the content changed. The timestamp on the last entry is the true last-updated date.

**Logic for scoring:**
1. Fetch the collapsed CDX results for the URL
2. Find the most recent entry — its `timestamp` is when the site last meaningfully changed
3. Compare that date to today
4. Apply the appropriate weight in the static sub-score (weight 20 if > 3 years ago, weight 10 if 2-3 years ago — mutually exclusive)
5. Store the date in the `last_changed` output column

**Caveats:**
- Wayback doesn't crawl every site. If there are no CDX results, skip this signal rather than penalizing.
- Very small content changes (cookie banner added, phone number updated) will show as a new digest even though the design hasn't changed. This is acceptable noise — a truly stale site will have a large gap regardless.
- The CDX API is free and requires no key, but rate-limit your requests to avoid being blocked (1 request/second is safe).

---

## Output Format

The scoring script outputs a CSV sorted by score ascending — lowest score = worst site = best prospect. Top candidates feed directly into the modernizer pipeline for before/after comparisons.

| Column | Type | Description |
|---|---|---|
| `url` | string | Homepage URL |
| `business_name` | string | From Places API or directory |
| `score` | 0-100 | Modernity score — lower is a better prospect |
| `no_ssl` | boolean | HTTPS fetch failed or cert error |
| `no_viewport` | boolean | Missing viewport meta tag |
| `last_changed` | date | True last-updated date from Wayback CDX (see below) |
| `old_wp_theme` | boolean | Old default WordPress theme detected |
| `no_og_tags` | boolean | No Open Graph meta tags |
| `table_layout` | boolean | Tables used for page layout |
| `static_score` | 0-100 | Normalized static HTML sub-score |
| `psi_score` | 0-100 | Weighted Lighthouse sub-score (performance 50%, SEO 30%, accessibility 20%) |
| `psi_performance` | 0-100 | Raw Lighthouse mobile performance score |
| `psi_seo` | 0-100 | Raw Lighthouse SEO score |
| `psi_accessibility` | 0-100 | Raw Lighthouse accessibility score |
| `notes` | string | Details — e.g. "wp-theme: twentyfifteen, copyright: 2016" |

---

## Notes on Outreach

Once you have a scored list:

- Show a screenshot of their current site next to the Lovable or Claude-generated output
- Emphasize mobile: most customers will find them on a phone before they call
- Frame it as a one-time project, not a subscription (lower barrier to yes)
- Contractors/trades respond to "more leads from Google" framing
- Professional services (dental, legal) respond to "credibility and trust" framing
