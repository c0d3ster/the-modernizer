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
- `results[].website` — the business URL to score (absent = greenfield lead)
- `results[].name` — business name for output
- `results[].formatted_phone_number` — for outreach CSV (requires Place Details call)
- `results[].vicinity` / `results[].formatted_address` — location for output
- `results[].user_ratings_total` — filter to 10-200 reviews (active but small)
- `results[].rating` — optional, not strongly correlated with site quality

**Note:** `formatted_phone_number` and `formatted_address` are not returned by Text Search — they require a follow-up Place Details call (`/place/details/json?place_id=...&fields=formatted_phone_number,formatted_address`). Batch these after Stage 1 to avoid hitting the Details API for businesses you'll drop anyway.

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
- `businesses[].id` — use with the Business Details endpoint to fetch `website` (not returned by Search)

**Note:** The Search endpoint does not include the business's own website URL. Call `GET /v3/businesses/{id}` for `website`, or scrape the Yelp listing page for the external link. This adds complexity — try Google Places first.

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
  → outputs: [{name, website, place_id, review_count, phone, address, city, state}]
  ↓
Stage 2 — Route by website presence
  → no website → greenfield-leads.csv (direct outreach, new build via c0d3ster)
  → has website + review_count < 5 or > 500 → drop
  → has website + chain detected (Domino's, Jiffy Lube, etc.) → drop
  → has website → continue to scoring
  ↓
Stage 3 — HTML fetch + static scoring
  → fetch homepage HTML (plain GET, no JS)
  → score against static signals (viewport, copyright, WP theme, OG tags, tables, SSL, old jQuery, IE meta)
  ↓
Stage 4 — Lighthouse / PSI scoring
  → call PSI API for mobile performance, SEO, and accessibility scores
  → adds ~2s per URL
  ↓
Stage 5 — Output ranked CSV
  → sort by score ascending (lowest = best prospect)
  → top 20 feed directly into the modernizer pipeline → candidates.csv
```

**Suggested script location:** `scripts/discover-candidates.ts`

**Output files:**
- `candidates.csv` — businesses with a website, sorted by modernity score (low = best prospect). Top candidates feed into `pnpm modernize`.
- `greenfield-leads.csv` — businesses with no website at all. Direct outreach for a new build; route to c0d3ster for project provisioning.

**Estimated run time:** ~5 min for 200 URLs, mostly PSI API latency (~2s per URL).

---

## Site Scoring Rubric

Scores work like Lighthouse: **100 = perfectly modern site**, **0 = completely outdated**. Lower scores are better prospects.

Scoring uses **two independent automated sub-scores** combined into a weighted final score. Each sub-score is normalized to 0-100 within its own category, so the total can never go out of range. All signals are fully automated — no human review step, making results consistent across runs.

### Final score formula

```
final = (static_score × 0.50) + (psi_score × 0.50)
```

**Thresholds:**
- **≤ 40** — strong candidate, clear visual case for modernization
- **41-60** — moderate candidate, worth a closer look
- **61+** — already modern enough that a pitch is hard to make

---

### Sub-score 1: Static HTML (50% weight)

Fast checks against raw HTML — no browser, no API key. Each signal has a weight. The sub-score is calculated as:

```
static_score = 100 × (1 − fired_weight / total_weight)
```

Non-staleness signals sum to 80. The staleness signal fills the remaining 20, giving a total of 100.

| Signal | Weight | Rationale |
|---|---|---|
| No HTTPS / expired SSL | 20 | Chrome has shown "Not Secure" since 2018 and Google has used HTTPS as a ranking signal since 2014. A site still on HTTP has been almost entirely untouched. Detection: `https://` fetch fails or returns a cert error. |
| No viewport meta tag | 20 | Absence means the site was built before mobile-first became standard (~2013). Google uses mobile-first indexing, so this also directly harms SEO. Detection: `<meta name="viewport">` absent from `<head>`. |
| Staleness (Wayback or copyright fallback) | 0-20 | Measures how long since the content actually changed. Reliable and not gameable via the CDX digest method. Capped at 20 because a site can look dated even if it publishes blog posts regularly — staleness alone isn't disqualifying. See formula below. |
| Old jQuery version | 12 | jQuery 1.x and 2.x were EOL in 2016 and 2014 respectively. Most unmaintained sites are still on these. A modern site uses jQuery 3.x or no jQuery at all. Detection: `jquery-1.` or `jquery-2.` in script `src` attributes. |
| WordPress with old default theme | 10 | WordPress ships a new default theme every year named after the year: Twenty Ten (2010) through Twenty Twenty-Five (2025). Sites using Twenty Ten through Twenty Nineteen haven't updated their theme in at least 5 years. Detection: `/wp-content/themes/(twentyten\|twentyeleven\|twentytwelve\|twentythirteen\|twentyfourteen\|twentyfifteen\|twentysixteen\|twentyseventeen\|twentyeighteen\|twentynineteen)/` in HTML source. |
| Table-based layout | 10 | Using `<table>` for page layout (rather than data) was standard before CSS floats and flexbox took over (~2008-2012). When this fires it's a near-certain indicator of a very old build. Detection: `<table>` elements containing layout columns rather than tabular data. |
| No Open Graph tags | 5 | OG tags have been standard practice since ~2012 and are added automatically by every major WordPress plugin (Yoast, RankMath, etc.). Absence suggests the site has never had an SEO plugin installed, which correlates with neglect. Detection: `<meta property="og:` absent. |
| IE compatibility meta tag | 3 | `<meta http-equiv="X-UA-Compatible" content="IE=edge">` was added by developers targeting Internet Explorer, which reached EOL in 2022. Its presence indicates the site hasn't been meaningfully touched since IE was a concern. Detection: `X-UA-Compatible` in meta tags. |

**Signals considered and not included:**

- **No canonical tag** — too common even on modern sites to be a useful signal
- **Flash / `.swf` references** — effectively extinct; would only fire on genuinely ancient sites already caught by table layout
- **Old Google Analytics (`ga.js`)** — detectable but rarely present since Universal Analytics was deprecated in 2023; `gtag.js` is now near-universal regardless of site age
- **Large unoptimized images** — overlaps with page weight signal; not worth a separate check
- **No favicon** — too noisy; many legitimate small businesses skip favicons
- **Fixed-width layout (e.g. `width: 960px`)** — would require CSS parsing, not just HTML; ruled out for static scoring complexity

---

**Staleness weight formula:**

If Wayback CDX returns snapshots for the URL, use the sliding scale based on years since the last digest change:

```
staleness_weight = min(years_since_last_change × 4, 20)
```

| Years since last update | Staleness weight |
|---|---|
| < 1 year | 0-4 |
| 1 year | 4 |
| 2 years | 8 |
| 3 years | 12 |
| 4 years | 16 |
| 5+ years | 20 (capped) |

If Wayback has **no data** for the URL, fall back to the copyright year regex (`©\s*(20(0[0-9]|1[0-9]))`) as a weak staleness signal worth **10 points** if it fires. This reduces the static score ceiling to 90 for those URLs, which is acceptable — no Wayback data also means a less confident score overall.

---

### Sub-score 2: Lighthouse / PSI (50% weight)

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

**PSI sub-score formula** — weighted average of three Lighthouse categories, with SEO and accessibility weighted higher than raw performance since server speed is not a signal of design neglect:

```
psi_score = (performance × 0.30) + (seo × 0.40) + (accessibility × 0.30)
```

After multiplying the raw API scores by 100, all three inputs are 0-100, so `psi_score` is always in range.

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
3. Calculate years elapsed since that timestamp
4. Compute staleness weight: `min(years × 4, 20)` and apply it in the static sub-score
5. Store the date in the `last_changed` output column

**Caveats:**
- Wayback doesn't crawl every site. If there are no CDX results, skip this signal rather than penalizing.
- Very small content changes (cookie banner added, phone number updated) will show as a new digest even though the design hasn't changed. This is acceptable noise — a truly stale site will have a large gap regardless.
- The CDX API is free and requires no key, but rate-limit your requests to avoid being blocked (1 request/second is safe).

---

## Output Format

The pipeline produces two separate CSV files.

### `candidates.csv`

Businesses with an existing website, sorted by modernity score ascending — lowest score = worst site = best modernization prospect. Top candidates feed directly into `pnpm modernize`.

| Column | Type | Description |
|---|---|---|
| `business_name` | string | From Places API |
| `phone` | string | Business phone number (from Place Details) |
| `address` | string | Street address |
| `city` | string | City |
| `state` | string | State |
| `url` | string | Homepage URL |
| `score` | 0-100 | Modernity score — lower is a better prospect |
| `no_ssl` | boolean | HTTPS fetch failed or cert error |
| `no_viewport` | boolean | Missing viewport meta tag |
| `last_changed` | date | True last-updated date from Wayback CDX |
| `old_jquery` | boolean | jQuery 1.x or 2.x detected in script src |
| `old_wp_theme` | boolean | Old default WordPress theme detected |
| `no_og_tags` | boolean | No Open Graph meta tags |
| `table_layout` | boolean | Tables used for page layout |
| `ie_compatible` | boolean | X-UA-Compatible meta tag present |
| `static_score` | 0-100 | Normalized static HTML sub-score |
| `psi_score` | 0-100 | Weighted Lighthouse sub-score (performance 30%, SEO 40%, accessibility 30%) |
| `psi_performance` | 0-100 | Raw Lighthouse mobile performance score |
| `psi_seo` | 0-100 | Raw Lighthouse SEO score |
| `psi_accessibility` | 0-100 | Raw Lighthouse accessibility score |
| `notes` | string | Details — e.g. "wp-theme: twentyfifteen, copyright: 2016" |

### `greenfield-leads.csv`

Businesses with no website detected. No scoring — they can't be crawled. Direct outreach for a greenfield build; route accepted projects to c0d3ster for repo and deployment provisioning.

| Column | Type | Description |
|---|---|---|
| `business_name` | string | From Places API |
| `phone` | string | Business phone number (from Place Details) |
| `address` | string | Street address |
| `city` | string | City |
| `state` | string | State |
| `vertical` | string | Business type from the discovery query (e.g. "plumber", "dentist") |
| `review_count` | number | Google review count — proxy for business activity |
| `rating` | number | Google rating |
| `place_id` | string | Google Place ID — for follow-up Details API calls if needed |

---

## Notes on Outreach

### Modernization candidates (`candidates.csv`)

- Generate a before/after using `pnpm modernize <url>` before reaching out — having a demo ready is the strongest pitch
- Show a screenshot of their current site next to the generated output
- Emphasize mobile: most customers will find them on a phone before they call
- Frame it as a one-time project, not a subscription (lower barrier to yes)
- Contractors/trades respond to "more leads from Google" framing
- Professional services (dental, legal) respond to "credibility and trust" framing

### Greenfield leads (`greenfield-leads.csv`)

- No before/after demo is possible — lead with the business category and show examples of similar sites you've built
- Frame it as: "your competitors are findable online and you're not"
- Accepted projects get provisioned through c0d3ster (repo from Next.js template, Vercel deployment, client portal access)
