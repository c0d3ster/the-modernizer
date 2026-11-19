/**
 * Runs inside the page via page.evaluate (self-contained) after scrolling down a screen: is a header
 * with links still pinned to the top? Looks at what sits at the top edge across the width and walks up
 * to a fixed or sticky ancestor near the top that holds links. A screenshot alone can't tell a pinned
 * header from a page that happens to show one, so the scorer gets this as a measured fact.
 */
export const headerSticks = (): boolean => {
  const vw = window.innerWidth
  for (const share of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    for (const el of document.elementsFromPoint(vw * share, 8)) {
      for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.position !== 'fixed' && style.position !== 'sticky') continue
        const r = node.getBoundingClientRect()
        if (r.top <= 4 && r.width > vw * 0.6 && r.height < window.innerHeight * 0.4 && node.querySelectorAll('a, button').length >= 2) return true
      }
    }
  }
  return false
}
