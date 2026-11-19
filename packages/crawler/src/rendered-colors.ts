import { chromium } from 'playwright'

export interface ColorSample {
  hex: string
  // Relative weight: rendered area of buttons and header fills, plus a share per link
  weight: number
}

// esbuild (tsx) wraps functions in __name(...) calls that page.evaluate carries into the page
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f)'

/**
 * Runs in the page: weighs the saturated colors a visitor actually sees on buttons, calls to action,
 * the header and links. Greys, near-white and near-black are ignored, so the result is the brand's
 * accent rather than the builder's default palette. Self-contained for page.evaluate.
 */
const measureColors = (): { hex: string; weight: number }[] => {
  const parse = (value: string): [number, number, number, number] | null => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(value)
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null
  }
  const saturated = ([r, g, b]: [number, number, number, number]): boolean => {
    const max = Math.max(r, g, b) / 255
    const min = Math.min(r, g, b) / 255
    const light = (max + min) / 2
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1))
    return sat >= 0.25 && light >= 0.15 && light <= 0.85
  }
  const hexOf = ([r, g, b]: [number, number, number, number]): string =>
    `#${[r, g, b].map((c) => (Math.round(c / 8) * 8).toString(16).padStart(2, '0').slice(-2)).join('')}`
  const weights = new Map<string, number>()
  const add = (value: string, weight: number): void => {
    const rgba = parse(value)
    if (!rgba || rgba[3] < 0.5 || !saturated(rgba)) return
    const hex = hexOf(rgba)
    weights.set(hex, (weights.get(hex) ?? 0) + weight)
  }
  const visible = (el: Element): DOMRect | null => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.top < window.innerHeight * 3 ? r : null
  }

  for (const el of document.querySelectorAll('button, a, [role=button], input[type=submit], [class*=btn i], [class*=button i]')) {
    const r = visible(el)
    if (!r) continue
    const style = getComputedStyle(el)
    add(style.backgroundColor, Math.min(r.width * r.height, 40_000))
    if (el.tagName === 'A') add(style.color, 400)
  }
  for (const el of document.querySelectorAll('header, nav, [role=banner]')) {
    const r = visible(el)
    if (r) add(getComputedStyle(el).backgroundColor, Math.min(r.width * r.height, 200_000) * 0.5)
  }
  return [...weights.entries()].map(([hex, weight]) => ({ hex, weight })).sort((a, b) => b.weight - a.weight).slice(0, 6)
}

/**
 * The brand colors a home page renders, strongest first. Reads computed styles in a real browser,
 * which works for site builders (Wix, Webflow, Squarespace) where the CSS text is mostly the builder's
 * own palette. Returns [] when the page cannot be loaded.
 */
export const sampleRenderedColors = async (url: string, { headless = true }: { headless?: boolean } = {}): Promise<ColorSample[]> => {
  const browser = await chromium.launch({ headless, executablePath: process.env.MODERNIZER_CHROMIUM_PATH })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript({ content: NAME_SHIM })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForTimeout(1500)
    return await page.evaluate(measureColors)
  } catch {
    return []
  } finally {
    await browser.close()
  }
}
