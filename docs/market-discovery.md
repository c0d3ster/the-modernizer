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

**API used:** Google Places API (New) Text Search (`places:searchText`). The legacy Places API (`/maps/api/place/...`) is not available to newly created Google Cloud projects.
**Cost:** ~$0.017 per request, $200/month free credit (enough for thousands of queries)
**Requires:** Google Cloud project with Places API (New) enabled

**Endpoint:**
```
POST https://places.googleapis.com/v1/places:searchText
Headers:
  X-Goog-Api-Key: YOUR_KEY
  X-Goog-FieldMask: places.id,places.displayName,places.websiteUri,places.userRatingCount,places.rating,places.nationalPhoneNumber,places.formattedAddress,nextPageToken
Body:
  { "textQuery": "plumber austin tx", "pageSize": 20 }
```

**Response fields to extract:**
- `places[].websiteUri` — the business URL to score (absent = greenfield lead)
- `places[].displayName.text` — business name for output
- `places[].nationalPhoneNumber` — for outreach CSV
- `places[].formattedAddress` — location for output
- `places[].userRatingCount` — filter to 10-200 reviews (active but small)
- `places[].rating` — optional, not strongly correlated with site quality

**Note:** Places API (New) only returns the fields named in `X-Goog-FieldMask`, and billing tier follows the fields requested. Website, rating, review count and phone are all in the Enterprise tier, so requesting phone and address in the same call adds no extra tier cost and no separate Place Details call is needed. `nextPageToken` must be in the field mask or pagination stops after page 1.

**Pagination:** Each response returns up to 20 results with a `nextPageToken`. Send it back as `pageToken` (with the same `textQuery`) for up to 3 pages (60 results) per query.

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
  → static v2 (copyright year, responsive images, inline styles) feeds the composite
  → the original static signals (viewport, WP theme, OG tags, tables, SSL, old jQuery, IE meta)
    are still reported as talking points
  ↓
Stage 4 — Lighthouse / PSI and visual scoring, side by side
  → one PSI call per site: SEO, accessibility and Best Practices categories plus five
    build-quality audits (needs PSI_API_KEY)
  → adds several seconds up to ~60s per URL (a full Lighthouse run, not a
    lightweight call — verified live against amazon.com at ~52s, which is why
    fetchPsiScore's timeout is 60s; small brochure sites finish well under that)
  → visual score: headless-browser screenshots judged by Claude against the design rubric
    (needs ANTHROPIC_API_KEY, about $0.03 per site, skip with --no-visual)
  ↓
Stage 5 — Output ranked CSV
  → sort by the composite ascending (lowest = best prospect); pitch = composite below 81
  → top 20 feed directly into the modernizer pipeline → candidates.csv
```

**Suggested script location:** `scripts/discover-candidates.ts`

**Output files:**
- `candidates.csv` — businesses with a website, sorted by modernity score (low = best prospect). Top candidates feed into `pnpm modernize`.
- `greenfield-leads.csv` — businesses with no website at all. Direct outreach for a new build; route to c0d3ster for project provisioning.

**Estimated run time:** dominated by PSI API latency, not the ~2s originally assumed — a sequential run of 200 URLs at several seconds to ~60s each could take well over an hour. `scripts/discover-candidates.ts` scores candidates 4 at a time by default (`--concurrency`), with Wayback CDX calls still held to 1 req/sec by a shared rate limiter; PSI's own limit is 25,000 queries/day (plenty of headroom), so the bottleneck is wall-clock time per call, not quota.

---

## Site Scoring Rubric

Scores work like Lighthouse: **100 = perfectly modern site**, **0 = completely outdated**. Lower scores are better prospects. Scores are absolute: never normalized per market or per vertical.

Scoring combines **six automated signals**, each 0-100, into one composite. The visual score carries half; the other five carry a tenth each. All signals are automated, with no human review step.

### Final score formula

```
final = visual × 0.5
      + static_v2 × 0.1
      + code × 0.1            (Lighthouse build-quality audits)
      + seo × 0.1
      + accessibility × 0.1
      + best_practices × 0.1
```

**Pitch when `final` is below 81.** The weights and cutoff live in `@modernizer/schema` (`COMPOSITE_WEIGHTS`, `PITCH_THRESHOLD`) so the scorer and the modernization report share them.

**Missing signals** (no `PSI_API_KEY`, a failed PSI call, no `ANTHROPIC_API_KEY`, a site that blocks the browser) drop out, and the remaining weights are scaled up to fill their share, so the score stays on the 0-100 scale. The `notes` column says which signals were left out.

**How it was chosen.** On the Winchester rating bench (47 hand-rated sites, 24 rated "pitch: yes", live PSI), the old formula (static plus performance, SEO and accessibility at 25% each) barely predicted the hand ratings: a site rated "yes" scored below a "no" only 53% of the time (AUC 0.53, where 0.5 is a coin flip). Raw Lighthouse performance pointed the wrong way (0.45), because polished sites carry video heroes and big photos. This composite reaches 0.92 on the same bench, with 91% of the sites it flags rated "yes". The non-visual signals keep real weight because the generators raise every one of them, so they also show the lift a rebuild gives: on 15 rebuilt sites the composite rose by 19 points on average and every rebuild cleared 81. Recheck the cutoff once a second city is rated.

---

### Sub-score: Visual design (50% weight)

`scoreSiteVisually` in `@modernizer/discovery`: a headless browser (Playwright) loads the homepage at laptop, phone and small-laptop sizes, measures layout facts (header bands, a pinned header, sideways scroll), and takes screenshots. Claude scores them against the design rubric in `@modernizer/design-guide`: it lists rule findings, a second pass rechecks them against each rule's exceptions, and the 100-point score is computed in code from the rule deductions, never by the model. About $0.03 per site. A site that serves a bot check, fails to load, or that the model marks unassessable gets no visual score.

If Playwright's expected Chromium build isn't installed, point `MODERNIZER_CHROMIUM_PATH` at an installed `chrome-headless-shell.exe`.

---

### Sub-score: Static HTML v2 (10% weight)

Three HTML checks that tracked the hand ratings, where the original static signals below almost never fire on today's small-business sites:

```
static_v2 = 100
          − 40 × min(copyright_years_behind / 4, 1)     (no copyright line counts as 1 year)
          − 30 × (no img/source with srcset)
          − 30 × min(inline_style_attributes / 150, 1)
```

| Signal | Bench AUC alone |
|---|---|
| Years since the newest copyright year | 0.67 |
| No responsive images (`srcset`) | 0.62 |
| Inline `style=` attribute count | 0.61 |
| Combined (static v2) | 0.73 |

The thresholds were picked on the same bench, so 0.73 is optimistic.

---

### Original static signals (reported, not in the score)

These are still computed and written to `candidates.csv` (`static_score` and the boolean columns) because they make good talking points ("your site has no HTTPS"), but they don't count toward the composite: on the bench the combined score predicted the hand ratings at 0.59, `ie_compatible` was noise (0.49) and `no_og_tags` pointed the wrong way (0.43). Fast checks against raw HTML, with no browser or API key. Each signal has a weight. The legacy sub-score is calculated as:

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

### Sub-scores: Lighthouse / PSI (10% weight each for build quality, SEO, accessibility and Best Practices)

Lighthouse is the open-source audit engine built into Chrome DevTools (Lighthouse tab). The PageSpeed Insights API runs the same engine server-side — no browser required, just an HTTP call.

**For automated scoring:**

```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url=https://example.com
  &strategy=mobile
  &key=YOUR_KEY
  &category=performance
  &category=seo
  &category=accessibility
  &category=best-practices
```

**Key response fields** (each multiplied by 100 to bring it into the 0-100 range):
- `lighthouseResult.categories.seo.score`: SEO, 10%
- `lighthouseResult.categories.accessibility.score`: accessibility, 10%
- `lighthouseResult.categories['best-practices'].score`: Best Practices, 10%
- `lighthouseResult.audits[...]`: build quality (`code`), 10%: the mean score of five audits that show how the page is built rather than how much media it carries: `legacy-javascript-insight`, `font-display-insight`, `duplicated-javascript-insight`, `bootup-time`, `unsized-images` (older Lighthouse ids without `-insight` are read too; an audit Lighthouse skipped counts as passed). On the bench this held up at about 0.62 on held-out sites.
- `lighthouseResult.categories.performance.score`: reported in `psi_performance`, **not** in the score (see "How it was chosen")

**Reported `psi_score` column:** the CSV still reports a weighted composite of the three categories for convenience, with SEO and accessibility weighted higher than raw performance within that composite:

```
psi_score = (performance × 0.30) + (seo × 0.40) + (accessibility × 0.30)
```

This composite is informational only; it is not part of the final score formula above.

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
| `score` | 0-100 | Composite modernity score (see "Final score formula"); lower is a better prospect |
| `no_ssl` | boolean | HTTPS fetch failed or cert error |
| `no_viewport` | boolean | Missing viewport meta tag |
| `last_changed` | date | True last-updated date from Wayback CDX |
| `old_jquery` | boolean | jQuery 1.x or 2.x detected in script src |
| `old_wp_theme` | boolean | Old default WordPress theme detected |
| `no_og_tags` | boolean | No Open Graph meta tags |
| `table_layout` | boolean | Tables used for page layout |
| `ie_compatible` | boolean | X-UA-Compatible meta tag present |
| `static_score` | 0-100 | Original static HTML sub-score (reported, not in the composite) |
| `psi_score` | 0-100 | Weighted Lighthouse sub-score (performance 30%, SEO 40%, accessibility 30%) |
| `psi_performance` | 0-100 | Raw Lighthouse mobile performance score (reported, not in the composite) |
| `psi_seo` | 0-100 | Raw Lighthouse SEO score |
| `psi_accessibility` | 0-100 | Raw Lighthouse accessibility score |
| `notes` | string | Details — e.g. "wp-theme: twentyfifteen, copyright: 2016" |
| `vertical` | string | Business type of the Places query that found it (e.g. `plumber`). Used to pick the generator's design profile. Older files without this column still parse. |
| `visual_points` | 0-100 | Visual design score; empty when it didn't run or couldn't see the site |
| `static_v2_score` | 0-100 | Static HTML v2 sub-score |
| `copyright_years_behind` | integer | Years since the newest copyright year; empty when the page has none |
| `no_srcset` | boolean | No responsive images on the homepage |
| `inline_styles` | integer | Count of inline `style=` attributes |
| `psi_best_practices` | 0-100 | Lighthouse Best Practices score |
| `psi_code` | 0-100 | Build-quality audit score |
| `pitch` | boolean | Composite below the pitch threshold (81) |
| `latitude` | number | Map pin from Google Places (`places.location`); empty for runs before coordinates were kept |
| `longitude` | number | Map pin from Google Places |

Columns are only ever appended, so files written before a column existed still parse (missing trailing columns read as empty).

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
| `latitude` | number | Map pin from Google Places |
| `longitude` | number | Map pin from Google Places |

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
