import type { PageFeatures } from '@modernizer/schema'

// Below this, a sideways scroll is usually a stray pixel or two, not a broken layout.
const OVERFLOW_TOLERANCE_PX = 20
// Losing this many menu links at 1366px means part of the menu is gone without a menu button.
const MENU_LINKS_LOST_THRESHOLD = 3
const OVERFLOW_CAP_PX = 600

/**
 * Compares the laptop view (1536px) with a fresh load at 1366px, a common small-laptop width, and
 * describes differences a rater or pitch should know about.
 */
export const smallLaptopIssues = (laptop: PageFeatures | null, small: PageFeatures | null): string[] => {
  if (!laptop || !small) return []
  const issues: string[] = []
  const wide = laptop.menuLinks.length
  const narrow = small.menuLinks.length

  if (small.menuButton && !laptop.menuButton && narrow < wide) {
    issues.push(`Menu collapses to a menu button (${wide} links down to ${narrow})`)
  } else if (wide - narrow >= MENU_LINKS_LOST_THRESHOLD) {
    issues.push(`Menu drops from ${wide} links to ${narrow}`)
  }

  if (small.overflowPx > OVERFLOW_TOLERANCE_PX) {
    issues.push(`Page scrolls sideways by ${small.overflowPx >= OVERFLOW_CAP_PX ? `${OVERFLOW_CAP_PX}px or more` : `${small.overflowPx}px`}`)
  }

  const mainButton = laptop.ctas[0]?.text
  if (mainButton && !small.ctas.some((c) => c.text.toLowerCase() === mainButton.toLowerCase())) {
    issues.push(`Main button "${mainButton}" is not in the first screen`)
  }
  return issues
}
