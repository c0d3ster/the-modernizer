import * as cheerio from 'cheerio'

const HEX_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
const WP_COLOR_RE = /--wp--preset--color--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g
const HAS_COLOR_CLASS_RE = /has-([a-z0-9-]+)-(background-color|color)\b/g

// CSS custom property names that strongly suggest a brand/primary color.
// Matches: --primary, --primary-color, --color-primary, --brand-color,
//          --accent, --accent-color, --theme-color, --main-color, --highlight-color
const BRAND_CSS_VAR_RE =
  /--(?:color-)?(?:primary|brand|accent|theme|main|highlight)(?:-color|-bg|-background)?:\s*(#[0-9a-fA-F]{3,8})/gi

// The standard Gutenberg default palette — present on every WordPress site,
// so these hex values alone are meaningless as brand signals.
const WP_DEFAULT_PALETTE = new Set([
  '#000000', '#abb8c3', '#ffffff', '#f78da7',
  '#cf2e2e', '#ff6900', '#fcb900', '#7bdcb5',
  '#00d084', '#8ed1fc', '#0693e3', '#9b51e0',
])

const IGNORED_GENERIC = new Set([
  '#ffffff', '#fff', '#000000', '#000',
  '#eeeeee', '#eee', '#f0f0f0', '#e5e5e5',
  '#333333', '#333', '#666666', '#666', '#999999', '#999',
])

const normalize = (hex: string): string => {
  const h = hex.toLowerCase()
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  return h
}

export interface ColorCandidate {
  // Human-readable label, e.g. "vivid-red" or "css-var-primary"
  label: string
  hex: string
  // Higher = more likely to be a brand color
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Extracts brand color candidates from crawled HTML pages and optional external CSS.
 *
 * Signal sources ranked by reliability:
 *
 * 1. `<meta name="theme-color">` — explicit per-site browser chrome color, highest confidence
 * 2. WordPress `has-X-background-color` classes on content blocks — editor explicitly chose this
 * 3. Brand-named CSS custom properties (--primary, --brand-color, --accent, etc.) in external CSS
 * 4. WP preset colors (--wp--preset--color--*) with names — passed with names so the LLM
 *    can reason about "vivid-red" vs "vivid-green-cyan"
 * 5. Frequency-ranked hex values from external CSS files
 * 6. Non-WP-default inline style hex values
 */
export const extractCandidateColors = (
  pages: Array<{ rawHtml: string }>,
  externalCss: string[] = [],
): ColorCandidate[] => {
  const blockColorCounts = new Map<string, number>() // slug → count
  const wpPresetColors = new Map<string, string>()   // slug → hex
  const inlineColors = new Map<string, number>()     // hex → count
  const themeColors: string[] = []

  for (const { rawHtml } of pages) {
    const $ = cheerio.load(rawHtml)

    // --- Signal 1: <meta name="theme-color"> — explicit brand signal ---
    $('meta[name="theme-color"]').each((_, el) => {
      const content = $(el).attr('content') ?? ''
      const match = content.match(/#[0-9a-fA-F]{3,8}/)
      if (match) {
        const hex = normalize(match[0])
        if (!IGNORED_GENERIC.has(hex)) themeColors.push(hex)
      }
    })

    // --- Signal 2: has-X-background-color class usage on blocks ---
    $('[class*="has-"][class*="-background-color"]').each((_, el) => {
      const cls = $(el).attr('class') ?? ''
      for (const match of cls.matchAll(HAS_COLOR_CLASS_RE)) {
        if (match[2] === 'background-color') {
          const slug = match[1]!
          blockColorCounts.set(slug, (blockColorCounts.get(slug) ?? 0) + 1)
        }
      }
    })

    // --- Signal 4: WP preset color variables (first page wins for names) ---
    $('style').each((_, el) => {
      const css = $(el).text()
      for (const match of css.matchAll(WP_COLOR_RE)) {
        const slug = match[1]!
        const hex = normalize(match[2]!)
        if (!wpPresetColors.has(slug)) {
          wpPresetColors.set(slug, hex)
        }
      }
    })

    // --- Signal 6: non-default inline style hex values ---
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') ?? ''
      for (const match of style.matchAll(HEX_RE)) {
        const hex = normalize(match[0])
        if (!IGNORED_GENERIC.has(hex) && !WP_DEFAULT_PALETTE.has(hex)) {
          inlineColors.set(hex, (inlineColors.get(hex) ?? 0) + 1)
        }
      }
    })
  }

  // --- Signal 3: brand-named CSS vars in external CSS files ---
  const brandCssVarColors: string[] = []
  // --- Signal 5: frequency-ranked hex values from external CSS ---
  const externalCssColors = new Map<string, number>() // hex → count

  for (const css of externalCss) {
    // brand-named CSS custom properties
    for (const match of css.matchAll(BRAND_CSS_VAR_RE)) {
      const hex = normalize(match[1]!)
      if (!IGNORED_GENERIC.has(hex) && !WP_DEFAULT_PALETTE.has(hex)) {
        brandCssVarColors.push(hex)
      }
    }

    // all hex values in the external CSS for frequency ranking
    for (const match of css.matchAll(HEX_RE)) {
      const hex = normalize(match[0])
      if (!IGNORED_GENERIC.has(hex) && !WP_DEFAULT_PALETTE.has(hex)) {
        externalCssColors.set(hex, (externalCssColors.get(hex) ?? 0) + 1)
      }
    }
  }

  const results: ColorCandidate[] = []
  const seen = new Set<string>()

  const push = (c: ColorCandidate): void => {
    if (!seen.has(c.hex)) {
      seen.add(c.hex)
      results.push(c)
    }
  }

  // Signal 1: theme-color meta
  for (const hex of themeColors) {
    push({ label: 'theme-color-meta', hex, confidence: 'high' })
  }

  // Signal 2: block background color class usage → high confidence
  for (const [slug] of [...blockColorCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const hex = wpPresetColors.get(slug)
    if (hex && !IGNORED_GENERIC.has(hex)) {
      push({ label: slug, hex, confidence: 'high' })
    }
  }

  // Signal 3: brand-named CSS vars → high confidence
  for (const hex of brandCssVarColors) {
    push({ label: 'css-var-brand', hex, confidence: 'high' })
  }

  // Signal 4: WP preset colors with names → medium confidence
  const greyishSlugs = new Set(['black', 'white', 'cyan-bluish-gray', 'pale-pink'])
  for (const [slug, hex] of wpPresetColors) {
    if (!greyishSlugs.has(slug) && !IGNORED_GENERIC.has(hex)) {
      push({ label: slug, hex, confidence: 'medium' })
    }
  }

  // Signal 5: frequency-ranked external CSS hex values → medium confidence
  for (const [hex] of [...externalCssColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    push({ label: 'external-css', hex, confidence: 'medium' })
  }

  // Signal 6: non-default inline style colors → low confidence
  for (const [hex] of [...inlineColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    push({ label: 'inline-style', hex, confidence: 'low' })
  }

  return results
}
