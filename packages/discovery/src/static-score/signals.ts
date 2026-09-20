import * as cheerio from 'cheerio'

// Matches both hyphenated filenames (jquery-2.2.4.min.js) and CDN path segments
// (/ajax/libs/jquery/2.2.4/jquery.min.js).
const OLD_JQUERY_PATTERN = /jquery(?:-|\/)[12]\./i

// WordPress default themes named after their release year, Twenty Ten (2010) through
// Twenty Nineteen (2019) — five years old is treated as "not updated in a while".
const OLD_WP_THEME_NAMES = [
  'twentyten',
  'twentyeleven',
  'twentytwelve',
  'twentythirteen',
  'twentyfourteen',
  'twentyfifteen',
  'twentysixteen',
  'twentyseventeen',
  'twentyeighteen',
  'twentynineteen',
]

const OLD_WP_THEME_PATTERN = new RegExp(
  `/wp-content/themes/(${OLD_WP_THEME_NAMES.join('|')})/`,
  'i'
)

export const detectNoViewport = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('head meta[name="viewport" i]').length === 0
}

export const detectOldJquery = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('script[src]')
    .toArray()
    .some((el) => OLD_JQUERY_PATTERN.test($(el).attr('src') ?? ''))
}

// Scoped to href/src attributes (not raw HTML text) so a theme path mentioned in
// body copy or an HTML comment can't trigger a false positive.
export const extractOldWpTheme = (html: string): string | null => {
  const $ = cheerio.load(html)
  for (const el of $('[href], [src]').toArray()) {
    const url = $(el).attr('href') ?? $(el).attr('src') ?? ''
    const match = OLD_WP_THEME_PATTERN.exec(url)
    if (match) return match[1] ?? null
  }
  return null
}

export const detectOldWpTheme = (html: string): boolean =>
  extractOldWpTheme(html) !== null

export const detectNoOgTags = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('meta[property^="og:"]').length === 0
}

// A <table> is treated as layout (not data) when it has no header cells, no <thead>,
// and no explicit ARIA table role — the absence of any of the usual "this is tabular
// data" markers is what layout-era tables look like. Markers are checked on each
// table independently: nested data tables (pricing, hours, menus) must not hide an
// outer layout table, which is the usual pre-CSS page structure.
export const detectTableLayout = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('table')
    .toArray()
    .some((el) => {
      const $table = $(el)
      const $own = $table.clone()
      $own.find('table').remove()
      const isDataTable =
        $own.find('th').length > 0 ||
        $own.find('thead').length > 0 ||
        $table.attr('role') === 'table'
      return !isDataTable
    })
}

export const detectIeCompatible = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('meta[http-equiv="X-UA-Compatible" i]').length > 0
}
