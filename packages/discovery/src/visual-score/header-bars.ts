import type { HeaderBand, VisualFinding } from '@modernizer/schema'

// A band painted by a photo this tall is the header sitting over the hero; colors can't split it
// into rows, so the measurement says nothing about how many bars there are
const UNREADABLE_PHOTO_BAND = 220
// Header bars are short; a taller band under the main header is where the content begins
const CONTENT_BAND = 160

export interface HeaderBars {
  bands: HeaderBand[]
  // Indexes of the bands that make up the main header (the menu row, and the logo row next to it)
  main: number[]
  // Bands beyond the main header, or null when the measurement can't tell
  extra: number | null
}

/**
 * Reads measured bands as a header: the logo row, plus the menu row right under it when the menu
 * has its own band, make up the main header. Every other band is an extra bar.
 */
export const summarizeHeaderBars = (bands: readonly HeaderBand[]): HeaderBars | null => {
  if (bands.length === 0) return null
  if (bands.some((b) => (b.background === 'image' || b.background === 'transparent') && b.height > UNREADABLE_PHOTO_BAND)) {
    return { bands: [...bands], main: [], extra: null }
  }
  // Utility bars sit above the logo, so the menu is the busiest row at or below the logo row
  const logo = Math.max(0, bands.findIndex((b) => b.logo))
  const menu = bands.reduce((best, band, i) => (i >= logo && band.links > (bands[best]?.links ?? -1) ? i : best), logo)
  const main = menu === logo || menu === logo + 1 ? [...new Set([logo, menu])] : [menu]
  // Below the main header, a tall band is the page content starting, not another bar
  const last = Math.max(...main)
  const header = bands.filter((b, i) => i <= last || b.height <= CONTENT_BAND)
  return { bands: header, main, extra: header.length - main.length }
}

const describeBand = (band: HeaderBand, isMain: boolean): string => {
  const holds = [band.logo && 'logo', band.phone && 'phone link', band.links && `${band.links} links`].filter(Boolean).join(', ')
  const fill = band.background === 'transparent' ? 'over the hero photo' : band.background === 'image' ? 'photo background' : band.background
  return `${band.height}px ${fill}${isMain ? ' (main header)' : ''}${holds ? `: ${holds}` : ''}${band.text ? ` ("${band.text}")` : ''}`
}

/** One plain-language line for the scoring prompt. */
export const describeHeaderBars = (label: string, bars: HeaderBars): string => {
  const list = bars.bands.map((b, i) => `${i + 1}) ${describeBand(b, bars.main.includes(i))}`).join('; ')
  if (bars.extra === null) return `${label} header sits over a photo, so its rows could not be measured: ${list}`
  return `${label} header measured top to bottom: ${bars.bands.length} band${bars.bands.length === 1 ? '' : 's'}, ${bars.extra} beyond the main header. ${list}`
}

/**
 * Holds the header-bars finding to what was measured: the model can't charge for more extra bars
 * than the page has. It can still charge fewer (a second bar with fresh links costs nothing).
 */
export const capHeaderBarFindings = (findings: readonly VisualFinding[], extra: number | null | undefined): VisualFinding[] => {
  if (extra === null || extra === undefined) return [...findings]
  return findings.flatMap((f) => {
    if (f.ruleId !== 'header-bars') return [f]
    const count = Math.min(f.count ?? 1, extra)
    return count > 0 ? [{ ...f, count }] : []
  })
}
