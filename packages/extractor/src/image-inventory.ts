import * as cheerio from 'cheerio'
import type { SiteImage, SiteImageKind } from '@modernizer/schema'

// Collects the images a site actually shows, so generators can reuse its real photos and logo instead
// of whatever ended up in an extracted block (on Wix sites often nothing but the logo).

interface PageHtml {
  url: string
  rawHtml: string
}

const LOGO_HINT = /logo|brand-mark|site-mark/i
const ICON_HINT = /icon|favicon|sprite|badge|arrow|chevron|star|social|facebook|instagram|twitter|youtube|linkedin|yelp|google-review/i
const ICON_MAX_PX = 128
const MAX_IMAGES = 60
const HEADER_SCOPE = 'header, nav, [role=banner], [id*=header i], [class*=header i]'

/** The largest candidate in a srcset ("a.jpg 1x, a@2x.jpg 2x" or "a.jpg 480w, b.jpg 1200w"). */
const largestFromSrcset = (srcset: string | undefined): string | undefined => {
  if (!srcset) return undefined
  const entries = srcset
    .split(/,\s+(?=\S)/)
    .map((part) => {
      const [url = '', descriptor = '1x'] = part.trim().split(/\s+/)
      return { url, size: Number.parseFloat(descriptor) || 1 }
    })
    .filter((e) => e.url)
  return entries.sort((a, b) => b.size - a.size)[0]?.url
}

/**
 * Full-size original for CDNs that serve resized or blurred placeholders in the HTML. Wix puts a
 * 147px blurred thumbnail in server HTML; the media id without the /v1/... transform is the original.
 */
export const originalImageUrl = (url: string): string => {
  const wix = /^(https:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\/.*$/.exec(url)
  if (wix?.[1]) return wix[1]
  if (/squarespace-cdn\.com|static1\.squarespace\.com/.test(url)) return `${url.split('?')[0]}?format=2500w`
  return url
}

/** Size the URL itself encodes: Wix "w_600,h_400", WordPress "-600x400.jpg", Brizy "-600x400x0x0x...". */
export const sizeFromUrl = (url: string): { width?: number; height?: number } => {
  const wix = /\/w_(\d+),h_(\d+)/.exec(url)
  if (wix) return { width: Number(wix[1]), height: Number(wix[2]) }
  const wp = /-(\d{2,5})x(\d{2,5})(?:x[\dx]+)?\.(?:jpe?g|png|webp|avif)/i.exec(url)
  if (wp) return { width: Number(wp[1]), height: Number(wp[2]) }
  return {}
}

const toNumber = (value: string | undefined): number | undefined => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const resolve = (src: string, pageUrl: string): string | null => {
  if (!src || src.startsWith('data:')) return null
  try {
    return new URL(src.trim(), pageUrl).toString()
  } catch {
    return null
  }
}

const isHomeLink = (href: string | undefined, pageUrl: string): boolean => {
  if (!href) return false
  try {
    const target = new URL(href, pageUrl)
    return target.origin === new URL(pageUrl).origin && (target.pathname === '/' || target.pathname === '')
  } catch {
    return false
  }
}

interface Candidate {
  src: string
  alt: string
  hints: string
  width?: number
  height?: number
  inHeader: boolean
  linksHome: boolean
}

const classify = (c: Candidate, url: string, headerImagesBefore: number): SiteImageKind => {
  const text = `${url} ${c.alt} ${c.hints}`
  if (LOGO_HINT.test(text)) return 'logo'
  // The first image in the header, or one linking home, is the logo on almost every small-business site
  if (c.inHeader && (c.linksHome || headerImagesBefore === 0) && !/\.svg(\?|$)/i.test(url) === !ICON_HINT.test(text)) return 'logo'
  if (/\.svg(\?|$)/i.test(url) || ICON_HINT.test(text)) return 'icon'
  const longest = Math.max(c.width ?? 0, c.height ?? 0)
  if (longest > 0 && longest <= ICON_MAX_PX) return 'icon'
  return 'photo'
}

/** Images on one page, in document order, with their kind. */
export const pageImages = ({ url: pageUrl, rawHtml }: PageHtml): SiteImage[] => {
  const $ = cheerio.load(rawHtml)
  const candidates: Candidate[] = []

  $('img').each((_, node) => {
    const el = $(node)
    const src =
      largestFromSrcset(el.attr('srcset') ?? el.attr('data-srcset')) ??
      el.attr('data-src') ??
      el.attr('data-lazy-src') ??
      el.attr('data-original') ??
      el.attr('src') ??
      ''
    const anchor = el.closest('a')
    candidates.push({
      src,
      alt: (el.attr('alt') ?? '').trim(),
      hints: `${el.attr('class') ?? ''} ${el.attr('id') ?? ''} ${el.parent().attr('class') ?? ''}`,
      width: toNumber(el.attr('width')),
      height: toNumber(el.attr('height')),
      inHeader: el.closest(HEADER_SCOPE).length > 0,
      linksHome: isHomeLink(anchor.attr('href'), pageUrl),
    })
  })

  // Section and hero photos are often CSS backgrounds rather than <img>
  $('[style*="background"]').each((_, node) => {
    const el = $(node)
    const match = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(el.attr('style') ?? '')
    if (!match?.[1]) return
    candidates.push({ src: match[1], alt: '', hints: `${el.attr('class') ?? ''} ${el.attr('id') ?? ''}`, inHeader: el.closest(HEADER_SCOPE).length > 0, linksHome: false })
  })

  const images: SiteImage[] = []
  let headerImages = 0
  for (const c of candidates) {
    const resolved = resolve(c.src, pageUrl)
    if (!resolved) continue
    const size = c.width && c.height ? { width: c.width, height: c.height } : sizeFromUrl(resolved)
    const kind = classify({ ...c, ...size }, resolved, headerImages)
    if (c.inHeader) headerImages += 1
    const url = kind === 'photo' ? originalImageUrl(resolved) : resolved
    images.push({
      url,
      ...(c.alt && { alt: c.alt }),
      // A swapped-in original is larger than the placeholder whose size the HTML or URL gave
      ...(url === resolved ? size : {}),
      kind,
      pageUrl,
      order: images.length,
    })
  }
  return images
}

/** schema.org Organization/LocalBusiness logo, when the site declares one. */
export const declaredLogo = ({ url: pageUrl, rawHtml }: PageHtml): string | null => {
  const $ = cheerio.load(rawHtml)
  for (const node of $('script[type="application/ld+json"]').toArray()) {
    const match = /"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/.exec($(node).text())
    if (match?.[1]) return resolve(match[1], pageUrl)
  }
  return null
}

/**
 * Images across the site, deduplicated by URL (first sighting wins, so home-page positions are
 * kept), plus the site logo.
 */
export const imageInventory = (pages: readonly PageHtml[]): { images: SiteImage[]; logoUrl?: string } => {
  const seen = new Set<string>()
  const images = pages.flatMap(pageImages).filter((img) => {
    // Icons and small graphics are never reused; keeping them out keeps the schema small
    if (img.kind === 'icon' || seen.has(img.url)) return false
    seen.add(img.url)
    return true
  })
  const home = pages[0]
  const logoUrl = (home && declaredLogo(home)) ?? images.find((i) => i.kind === 'logo' && i.pageUrl === home?.url)?.url ?? images.find((i) => i.kind === 'logo')?.url
  return { images: images.slice(0, MAX_IMAGES), ...(logoUrl && { logoUrl }) }
}
