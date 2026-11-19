import type { HeaderBand } from '@modernizer/schema'

/**
 * Runs inside the page via page.evaluate (self-contained, no module scope). Measures the header
 * area as horizontal bands: walks down the left edge of the page from the top, reading what paints
 * the background at each row, and starts a new band whenever that changes. Stops where the hero or
 * content starts. Each band reports what it holds (links, a phone link, a logo) so the scorer can
 * tell a utility bar from the main header. Must run with the page scrolled to the top.
 */
export const measureHeaderBands = (): HeaderBand[] => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const STEP = 2
  const MIN_BAND = 16
  const SAMPLE_XS = [0.01, 0.2, 0.35, 0.5, 0.65, 0.8, 0.99]

  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const hex = (value: string): string | null => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(value)
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null
    return `#${[m[1], m[2], m[3]].map((c) => Math.round(Number(c)).toString(16).padStart(2, '0')).join('')}`
  }
  const textOf = (el: Element): string => (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const isMedia = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    return (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS' || el.tagName === 'PICTURE') && r.width > vw * 0.5 && r.height > 150
  }
  // What paints the background behind a point: the first opaque fill or large photo in the stack
  const paint = (x: number, y: number): { background: string; owner: Element | null } => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (isMedia(el)) return { background: 'image', owner: el }
      const s = getComputedStyle(el)
      if (s.backgroundImage && s.backgroundImage !== 'none' && el.getBoundingClientRect().height > 150) return { background: 'image', owner: el }
      const color = hex(s.backgroundColor)
      if (color) return { background: color, owner: el }
    }
    return { background: '#ffffff', owner: null }
  }

  // Where the header area ends: the first big hero-like thing, or the bottom of the site header
  // when the header sits over the hero
  const heroTop = (): number => {
    let top = vh * 0.5
    for (const el of document.querySelectorAll('h1, img, video, section, [class*=hero i], [class*=banner i], [class*=slider i]')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < vw * 0.5) continue
      if (el.tagName === 'H1' ? r.top > 0 : r.height >= 200 && r.top >= 12) top = Math.min(top, r.top)
    }
    return top
  }
  // Skip links are visible to the measurement but not to a visitor
  const clickable = [...document.querySelectorAll('a, button')].filter((a) => visible(a) && !/^skip to/i.test(textOf(a)))
  const headerBottom = (): number => {
    let bottom = 0
    for (const el of document.querySelectorAll('header, [role=banner], nav')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.top < vh * 0.4 && r.width > vw * 0.6 && r.height < vh * 0.5) bottom = Math.max(bottom, r.bottom)
    }
    // A menu row built from plain divs: four or more links side by side near the top
    const rows = new Map<number, number>()
    for (const a of clickable) {
      const r = a.getBoundingClientRect()
      if (r.top > vh * 0.4 || r.height > 80) continue
      const row = Math.round((r.top + r.height / 2) / 10)
      rows.set(row, (rows.get(row) ?? 0) + 1)
    }
    for (const [row, count] of rows) if (count >= 4) bottom = Math.max(bottom, row * 10 + 20)
    return bottom
  }
  const headerEnd = Math.min(headerBottom(), vh * 0.5)
  const end = Math.max(Math.min(heroTop(), vh * 0.5), headerEnd)

  const runs: { top: number; bottom: number; background: string }[] = []
  for (let y = 1; y < end; y += STEP) {
    // Majority across the width, so a button doesn't split a band and a width-constrained header
    // (which leaves the page edges plain) still shows its own fill
    const votes = new Map<string, number>()
    for (const share of SAMPLE_XS) {
      const { background: fill } = paint(Math.min(vw - 2, Math.max(2, vw * share)), y)
      votes.set(fill, (votes.get(fill) ?? 0) + 1)
    }
    const background = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#ffffff'
    const last = runs[runs.length - 1]
    // A photo that starts below the bars is the hero, unless a menu row still sits on it
    if (background === 'image' && y > 8 && (!last || last.background !== 'image') && y >= headerEnd) break
    if (last && last.background === background) last.bottom = y + STEP
    else runs.push({ top: y - 1, bottom: y + STEP, background })
  }

  const images = [...document.querySelectorAll('img, svg')].filter(visible)
  const textLeaves = [...document.querySelectorAll('body *')].filter(
    (el) => el.children.length === 0 && textOf(el).length > 1 && !/^skip to/i.test(textOf(el)) && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) && visible(el)
  )
  const centerIn = (el: Element, top: number, bottom: number): boolean => {
    const r = el.getBoundingClientRect()
    const mid = r.top + r.height / 2
    return mid >= top && mid < bottom
  }

  return runs
    .filter((run) => run.bottom - run.top >= MIN_BAND)
    .map((run): HeaderBand => {
      const links = clickable.filter((a) => centerIn(a, run.top, run.bottom))
      const linkWords = links.map(textOf).filter((t) => t.length > 0 && t.length < 40)
      const words = linkWords.length > 0 ? linkWords : textLeaves.filter((el) => centerIn(el, run.top, run.bottom)).map(textOf).filter((t) => t.length < 60)
      const logo = images.some((img) => {
        const r = img.getBoundingClientRect()
        return centerIn(img, run.top, run.bottom) && r.left < vw * 0.4 && r.width >= 60 && r.height >= 24
      })
      return {
        top: Math.round(run.top),
        height: Math.round(run.bottom - run.top),
        background: run.background === 'image' && run.top < 4 && links.length > 0 ? 'transparent' : run.background,
        links: links.length,
        phone: links.some((a) => a.getAttribute('href')?.startsWith('tel:') ?? false),
        logo,
        text: words.join(' | ').slice(0, 120),
      }
    })
    // Empty filler (spacing, the top of the hero) is not a bar
    .filter((band) => band.links > 0 || band.logo || band.text.length > 0)
}
