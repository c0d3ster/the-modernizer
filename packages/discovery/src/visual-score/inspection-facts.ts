import type { PageFeatures, SiteInspection, ViewInspection } from '@modernizer/schema'

import { describeHeaderBars, summarizeHeaderBars } from './header-bars.js'

const VIEW_LABELS: Record<ViewInspection['viewport'], string> = { desktop: 'Laptop', mobile: 'Phone', small: 'Small laptop' }

const viewFacts = (label: string, f: PageFeatures): string[] => {
  const lines = [
    `${label} menu: ${f.menuLinks.length ? `${f.menuLinks.length} links in the first screen (${f.menuLinks.join(', ')})` : 'no menu links in the first screen'}${f.menuButton ? ', plus a menu button' : ''}`,
    `${label} buttons in the first screen: ${f.ctas.length ? f.ctas.map((c) => `"${c.text}" (${c.goesTo})`).join('; ') : 'none found'}`,
  ]
  // Only worth saying when it shows: a number on screen that can't be tapped
  if (!f.telLinks && f.phoneInText) lines.push(`${label} phone number appears only as plain text, with no tap-to-call link anywhere on the page`)
  if (f.heroVideo) lines.push(`${label} hero is a video (screenshots show one frame)`)
  if (f.overflowPx > 20) lines.push(`${label} page scrolls sideways by ${f.overflowPx >= 600 ? '600px or more' : `${f.overflowPx}px`}`)
  return lines
}

const isHomePage = (url: string): boolean => {
  try {
    return ['', '/'].includes(new URL(url).pathname)
  } catch {
    return true
  }
}

/** Plain-language facts from a browser inspection, for the visual scoring prompt. */
export const describeInspectionFacts = (inspection: SiteInspection): string => {
  const lines: string[] = []
  const page = inspection.finalUrl ?? inspection.url
  lines.push(`Page: ${page}${isHomePage(page) ? '' : ' (not the home page; this is the link listed for the business)'}`)

  for (const view of inspection.views) {
    if (view.viewport === 'small' || !view.features) continue
    lines.push(...viewFacts(VIEW_LABELS[view.viewport], view.features))
  }
  const laptop = inspection.views.find((v) => v.viewport === 'desktop')?.features
  const bars = laptop?.headerBands ? summarizeHeaderBars(laptop.headerBands) : null
  if (bars) lines.push(describeHeaderBars('Laptop', bars))
  if (laptop?.fonts.length) lines.push(`Main fonts: ${laptop.fonts.join(', ')}`)
  if (laptop?.copyright) lines.push(`Copyright year in the footer: ${laptop.copyright}`)

  lines.push(
    inspection.coverage.length
      ? `Covering the first screen on load: ${inspection.coverage.map((c) => `${VIEW_LABELS[c.viewport]}: ${c.text}`).join('; ')}`
      : 'Nothing covers the first screen on load'
  )
  lines.push(
    inspection.smallLaptopIssues.length
      ? `At small-laptop width (1366px): ${inspection.smallLaptopIssues.join('; ')}`
      : 'No layout changes found at small-laptop width (1366px)'
  )
  if (inspection.projectFeatures.length) {
    lines.push(`Already on the site: ${inspection.projectFeatures.map((f) => `${f.label} (${f.detail})`).join('; ')}`)
  }
  return lines.map((l) => `- ${l}`).join('\n')
}
