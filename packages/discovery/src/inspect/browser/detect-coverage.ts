import type { CoverageItem } from '@modernizer/schema'

/**
 * Runs inside the page right after load, before anything is dismissed, and reports what covers the
 * first screen: cookie banners, popups or modals, oversized fixed headers, and floating elements that
 * sit on top of text. Self-contained for page.evaluate.
 *
 * Coverage is measured on a grid of points, not bounding boxes. A point counts for an overlay only
 * when the topmost element there belongs to it and paints something (a background, media or text).
 * That keeps full-screen fixed background layers (common on Wix) and transparent widget wrappers from
 * reading as a popup covering the whole page.
 */
export const detectCoverage = (): CoverageItem[] => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const COLS = 32
  const ROWS = 18

  type Box = { left: number; top: number; right: number; bottom: number }
  type Hits = { count: number; top: number; bottom: number }

  const shown = (el: Element): boolean => {
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05
  }
  const innerTextOf = (el: Element): string => (el instanceof HTMLElement ? el.innerText : el.textContent ?? '')
  const MEDIA = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'IFRAME', 'PICTURE', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'])

  const paints = (node: Element): boolean => {
    if (MEDIA.has(node.tagName.toUpperCase())) return true
    const s = getComputedStyle(node)
    if (s.backgroundImage && s.backgroundImage !== 'none') return true
    const alpha = /rgba?\(([^)]+)\)/.exec(s.backgroundColor)?.[1]?.split(',')[3]
    if (s.backgroundColor !== 'transparent' && (alpha === undefined || Number(alpha) > 0.1)) return true
    return [...node.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim().length > 0)
  }
  // Does anything between the hit element and the overlay root paint at this point?
  const paintsHere = (hit: Element, root: Element): boolean => {
    for (let n: Element | null = hit; n; n = n.parentElement) {
      if (paints(n)) return true
      if (n === root) return false
    }
    return false
  }

  const overlays = [...document.querySelectorAll('body *')].filter((el) => {
    const position = getComputedStyle(el).position
    return (position === 'fixed' || position === 'sticky') && shown(el)
  })
  const outermost = overlays.filter((el) => !overlays.some((other) => other !== el && other.contains(el)))
  const firstLine = (el: Element): string =>
    innerTextOf(el).trim().split('\n').map((t) => t.trim()).find((t) => t.length > 2)?.slice(0, 80) ?? ''

  const hits = new Map<Element, Hits>(outermost.map((el) => [el, { count: 0, top: vh, bottom: 0 }]))
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const y = ((r + 0.5) / ROWS) * vh
      const hit = document.elementFromPoint(((c + 0.5) / COLS) * vw, y)
      if (!hit) continue
      const root = outermost.find((el) => el.contains(hit))
      const h = root ? hits.get(root) : undefined
      if (!root || !h || !paintsHere(hit, root)) continue
      h.count += 1
      h.top = Math.min(h.top, y)
      h.bottom = Math.max(h.bottom, y)
    }
  }

  // Counts page text under the box that the box is drawn on top of, i.e. text a visitor can't read.
  const textHidden = (el: Element, box: Box): number => {
    let found = 0
    let checked = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node && checked < 4000 && found < 3; node = walker.nextNode()) {
      checked += 1
      const parent = node.parentElement
      if ((node.textContent ?? '').trim().length <= 3 || !parent || el.contains(parent) || !shown(parent)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      if (!r.width || !r.height || r.left >= box.right || r.right <= box.left || r.top >= box.bottom || r.bottom <= box.top) continue
      const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2))
      const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2))
      const top = document.elementFromPoint(cx, cy)
      if (top && el.contains(top) && paintsHere(top, el)) found += 1
    }
    return found
  }

  const items: CoverageItem[] = []
  const seen = new Set<string>()
  for (const el of outermost) {
    const h = hits.get(el)
    if (!h) continue
    const share = h.count / (COLS * ROWS)
    if (share < 0.02) continue
    const rect = el.getBoundingClientRect()
    const box: Box = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(vw, rect.right), bottom: Math.min(vh, rect.bottom) }
    const text = innerTextOf(el)
    const markers = `${el.getAttribute('role') ?? ''} ${el.getAttribute('aria-modal') ?? ''} ${el.getAttribute('class') ?? ''} ${el.id}`
    let kind: CoverageItem['kind']
    if (/cookie|privacy policy|consent|gdpr|ccpa|we use cookies/i.test(text.slice(0, 600))) kind = 'cookie banner'
    // A popup-like element under 5% (a badge or chat bubble) is judged like any floating element
    else if ((/dialog|modal|popup|pop-up|lightbox|overlay|newsletter|promo/i.test(markers) && share >= 0.05) || share > 0.45) kind = 'popup'
    else if (box.top <= 2 && box.bottom < vh * 0.6) kind = 'header'
    else kind = 'floating'
    if (kind === 'header' && share < 0.22) continue // a normal sticky header
    if (kind === 'floating' && textHidden(el, box) === 0) continue // a floating button over empty space is fine
    const half = vh / ROWS / 2
    const top = Math.max(0, Math.round(h.top - half))
    const bottom = Math.min(vh, Math.round(h.bottom + half))
    const where: CoverageItem['where'] = top <= 2 && bottom >= vh - 2 ? 'full screen' : top <= 2 ? 'top' : bottom >= vh - 60 ? 'bottom' : 'middle'
    const label = firstLine(el)
    const key = `${kind}|${label}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ kind, pct: Math.round(share * 100), where, label, top, bottom })
  }
  return items.sort((a, b) => b.pct - a.pct).slice(0, 5)
}
