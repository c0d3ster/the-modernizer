import { fetchCdxSnapshots } from './wayback-cdx.js'
import type { CdxSnapshot } from './wayback-cdx.js'

export const STALENESS_MAX_WEIGHT = 20
export const COPYRIGHT_FALLBACK_WEIGHT = 10
const YEARS_TO_WEIGHT_MULTIPLIER = 4
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

// Weak fallback for when Wayback has no CDX data at all — most CMS platforms
// auto-update this in the footer, so it's noisy, but better than no signal.
const COPYRIGHT_YEAR_PATTERN = /©\s*(20(0[0-9]|1[0-9]))/

export type StalenessSource = 'wayback' | 'copyright-fallback' | 'none'

export interface StalenessResult {
  lastChanged: string | null
  stalenessWeight: number
  source: StalenessSource
}

export interface StalenessOptions {
  fetchSnapshots?: (url: string) => Promise<CdxSnapshot[]>
  now?: Date
}

// CDX timestamps are YYYYMMDDhhmmss in UTC.
const parseCdxTimestamp = (timestamp: string): Date => {
  const year = timestamp.slice(0, 4)
  const month = timestamp.slice(4, 6)
  const day = timestamp.slice(6, 8)
  const hour = timestamp.slice(8, 10) || '00'
  const minute = timestamp.slice(10, 12) || '00'
  const second = timestamp.slice(12, 14) || '00'
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
}

const yearsBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / MS_PER_YEAR

// `years` is used as a continuous fraction, not rounded — the documented table's own
// boundary values (4, 8, 12...) fall directly out of `years * 4` at whole-year marks,
// and its "< 1 year: 0-4" row confirms the sub-year range is meant to scale smoothly
// rather than step at a fixed cutoff.
export const computeStalenessWeightFromYears = (years: number): number =>
  Math.min(
    Math.max(years, 0) * YEARS_TO_WEIGHT_MULTIPLIER,
    STALENESS_MAX_WEIGHT
  )

const toDateString = (date: Date): string => date.toISOString().slice(0, 10)

export const computeStaleness = async (
  url: string,
  html: string,
  {
    fetchSnapshots = fetchCdxSnapshots,
    now = new Date(),
  }: StalenessOptions = {}
): Promise<StalenessResult> => {
  const snapshots = await fetchSnapshots(url)

  // With `collapse=digest`, snapshots are ascending by timestamp — the last entry is the
  // most recent content change, whether it's the only entry or the fiftieth. A single
  // snapshot just means the content hasn't changed since Wayback's first crawl in the
  // queried window; treating it the same way is a conservative underestimate of true
  // staleness (never overestimates), which is the safe direction for a scoring signal.
  const mostRecent = snapshots.at(-1)
  if (mostRecent) {
    const lastChangedDate = parseCdxTimestamp(mostRecent.timestamp)
    return {
      lastChanged: toDateString(lastChangedDate),
      stalenessWeight: computeStalenessWeightFromYears(
        yearsBetween(lastChangedDate, now)
      ),
      source: 'wayback',
    }
  }

  const copyrightMatch = COPYRIGHT_YEAR_PATTERN.exec(html)
  if (copyrightMatch) {
    return {
      lastChanged: null,
      stalenessWeight: COPYRIGHT_FALLBACK_WEIGHT,
      source: 'copyright-fallback',
    }
  }

  return { lastChanged: null, stalenessWeight: 0, source: 'none' }
}
