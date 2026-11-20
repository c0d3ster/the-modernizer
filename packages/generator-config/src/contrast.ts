// WCAG 2.x contrast math for theme colors. Only hex colors are adjusted; anything else
// (rgb(), hsl(), oklch()) passes through untouched because it can't be measured here.

interface Rgb {
  r: number
  g: number
  b: number
}

/** Minimum contrast for normal-size text (WCAG AA), the bar Lighthouse checks. */
export const TEXT_CONTRAST = 4.5

export const parseHex = (color: string): Rgb | null => {
  const hex = color.trim().replace(/^#/, '')
  if (!/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null
  const full = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6)
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) }
}

const toHex = ({ r, g, b }: Rgb): string => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const channel = (v: number): number => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const luminance = ({ r, g, b }: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** Contrast ratio between two hex colors, or null when either can't be parsed. */
export const contrastRatio = (a: string, b: string): number | null => {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return null
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** The candidate that reads best on `background`: the first that clears `min`, else the highest. */
export const readableOn = (background: string, candidates: readonly string[], min = TEXT_CONTRAST): string => {
  const scored = candidates.map((c) => ({ c, ratio: contrastRatio(c, background) ?? 0 }))
  return (scored.find((s) => s.ratio >= min) ?? scored.sort((x, y) => y.ratio - x.ratio)[0])?.c ?? candidates[0] ?? background
}

const mix = (from: Rgb, to: Rgb, t: number): Rgb => ({
  r: from.r + (to.r - from.r) * t,
  g: from.g + (to.g - from.g) * t,
  b: from.b + (to.b - from.b) * t,
})

/**
 * Darkens (on light surfaces) or lightens (on dark ones) a brand color just enough to clear
 * `min` against every surface, keeping its hue. Returns the color unchanged when it already
 * passes or can't be parsed.
 */
export const ensureContrast = (color: string, surfaces: readonly string[], min = TEXT_CONTRAST): string => {
  const base = parseHex(color)
  const parsed = surfaces.map(parseHex).filter((s): s is Rgb => s !== null)
  if (!base || parsed.length === 0) return color
  const passes = (c: Rgb): boolean => parsed.every((s) => (contrastRatio(toHex(c), toHex(s)) ?? 0) >= min)
  if (passes(base)) return color
  const lightSurfaces = parsed.reduce((sum, s) => sum + luminance(s), 0) / parsed.length > 0.18
  const target: Rgb = lightSurfaces ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  for (let step = 1; step <= 100; step++) {
    const candidate = mix(base, target, step / 100)
    if (passes(candidate)) return toHex(candidate)
  }
  // Surfaces on both ends (a dark page with light cards): no single shade fits, so keep the brand color
  return color
}
