import type { CoverageItem, CoverageNote, ViewInspection } from '@modernizer/schema'

/** One plain-language line for a rater or a pitch, e.g. "Cookie banner covers 73% of the first screen (bottom)". */
export const describeCoverage = ({ kind, pct, where, label }: CoverageItem): string => {
  if (kind === 'cookie banner') return `Cookie banner covers ${pct}% of the first screen (${where})`
  if (kind === 'popup') return `Popup covers ${pct}% of the first screen on load${label ? `: "${label}"` : ''}`
  if (kind === 'header') return `Fixed header and bars take ${pct}% of the first screen`
  return `Floating element covers text${label ? ` ("${label}")` : ''}`
}

/** Coverage notes for the laptop and mobile views (the small-laptop view repeats the laptop findings). */
export const coverageNotes = (views: ViewInspection[]): CoverageNote[] =>
  views
    .filter((v) => v.viewport !== 'small')
    .flatMap((v) => v.covered.map((c) => ({ viewport: v.viewport, kind: c.kind, text: describeCoverage(c) })))

/** Kinds that hide the design itself, so a screenshot of the page as loaded is worth keeping. */
export const coversDesign = (items: CoverageItem[]): boolean => items.some((c) => c.kind === 'cookie banner' || c.kind === 'popup')
