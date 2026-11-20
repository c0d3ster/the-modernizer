import * as cheerio from 'cheerio'

// Static v2: three HTML signals that tracked the hand-rated pitch calls on the Winchester bench
// (47 sites), where the original static signals (table layouts, IE meta, missing viewport) almost
// never fire on today's small-business sites. Weights sum to 100.
export const STATIC_V2_WEIGHTS = {
  // Full deduction at 4+ years behind; a page with no copyright line counts as 1 year
  copyright: 40,
  // No responsive images anywhere on the page
  noSrcset: 30,
  // Full deduction at 150+ inline style attributes (page-builder and hand-styled markup)
  inlineStyles: 30,
} as const

const COPYRIGHT_YEARS_FOR_FULL_DEDUCTION = 4
const INLINE_STYLES_FOR_FULL_DEDUCTION = 150
const MISSING_COPYRIGHT_YEARS = 1

// "© 2019", "&copy; 2015 - 2023", "Copyright 2021": the latest year in a range counts
const COPYRIGHT_PATTERN = /(?:©|&copy;|copyright)[^<]{0,40}?((?:19|20)\d\d)(?:\s*[-–]\s*((?:19|20)\d\d))?/gi

export interface StaticV2Result {
  score: number
  // Years since the newest copyright year on the page; null when there is none
  copyrightYearsBehind: number | null
  noSrcset: boolean
  inlineStyles: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const latestCopyrightYear = (html: string): number | null => {
  const years = [...html.matchAll(COPYRIGHT_PATTERN)].map((m) => Number(m[2] ?? m[1]))
  return years.length ? Math.max(...years) : null
}

export const computeStaticV2 = ({ html, now = new Date() }: { html: string; now?: Date }): StaticV2Result => {
  const $ = cheerio.load(html)
  const year = latestCopyrightYear(html)
  const copyrightYearsBehind = year === null ? null : Math.max(0, now.getFullYear() - year)
  const noSrcset = $('img[srcset], source[srcset]').length === 0
  const inlineStyles = $('[style]').length
  const score =
    100 -
    STATIC_V2_WEIGHTS.copyright * clamp01((copyrightYearsBehind ?? MISSING_COPYRIGHT_YEARS) / COPYRIGHT_YEARS_FOR_FULL_DEDUCTION) -
    STATIC_V2_WEIGHTS.noSrcset * (noSrcset ? 1 : 0) -
    STATIC_V2_WEIGHTS.inlineStyles * clamp01(inlineStyles / INLINE_STYLES_FOR_FULL_DEDUCTION)
  return { score, copyrightYearsBehind, noSrcset, inlineStyles }
}
