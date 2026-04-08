import * as cheerio from 'cheerio'

const HEX_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
const WP_COLOR_RE = /--wp--preset--color--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g
const HAS_COLOR_CLASS_RE = /has-([a-z0-9-]+)-(background-color|color)\b/g

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
  // Human-readable label, e.g. "vivid-red" or "inline-style"
  label: string
  hex: string
  // Higher = more likely to be a brand color
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Extracts brand color candidates from crawled HTML pages.
 *
 * Three signal sources ranked by reliability:
 *
 * 1. WordPress `has-X-background-color` classes on content blocks — the site
 *    editor explicitly chose this color, highest confidence.
 * 2. WP preset colors (--wp--preset--color--*) with names — passed with names
 *    so the LLM can reason about "vivid-red" vs "vivid-green-cyan".
 * 3. Non-WP-default inline style hex values — any remaining inline color usage.
 *
 * Note: colors in external .css files are not available without fetching them.
 * For sites whose brand colors are applied only via external CSS (common with
 * Genesis/classic themes), this will return WP preset candidates with names
 * and rely on the LLM to pick the most plausible one.
 */
export const extractCandidateColors = (
  pages: Array<{ rawHtml: string }>,
): ColorCandidate[] => {
  const blockColorCounts = new Map<string, number>() // slug → count
  const wpPresetColors = new Map<string, string>()   // slug → hex
  const inlineColors = new Map<string, number>()     // hex → count

  for (const { rawHtml } of pages) {
    const $ = cheerio.load(rawHtml)

    // --- Signal 1: has-X-background-color class usage on blocks ---
    $('[class*="has-"][class*="-background-color"]').each((_, el) => {
      const cls = $(el).attr('class') ?? ''
      for (const match of cls.matchAll(HAS_COLOR_CLASS_RE)) {
        if (match[2] === 'background-color') {
          const slug = match[1]!
          blockColorCounts.set(slug, (blockColorCounts.get(slug) ?? 0) + 1)
        }
      }
    })

    // --- Signal 2: WP preset color variables (first page wins for names) ---
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

    // --- Signal 3: non-default inline style hex values ---
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

  const results: ColorCandidate[] = []

  // Signal 1: block background color class usage → high confidence
  // Resolve the slug back to a hex via WP preset map
  for (const [slug] of [...blockColorCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const hex = wpPresetColors.get(slug)
    if (hex && !IGNORED_GENERIC.has(hex)) {
      results.push({ label: slug, hex, confidence: 'high' })
    }
  }

  // Signal 2: WP preset colors with names → medium confidence
  // Exclude white/black/grey slugs that are clearly not brand colors
  const greyishSlugs = new Set(['black', 'white', 'cyan-bluish-gray', 'pale-pink'])
  for (const [slug, hex] of wpPresetColors) {
    if (!greyishSlugs.has(slug) && !IGNORED_GENERIC.has(hex)) {
      if (!results.some((r) => r.hex === hex)) {
        results.push({ label: slug, hex, confidence: 'medium' })
      }
    }
  }

  // Signal 3: non-default inline style colors → low confidence
  for (const [hex] of [...inlineColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    if (!results.some((r) => r.hex === hex)) {
      results.push({ label: 'inline-style', hex, confidence: 'low' })
    }
  }

  return results
}
