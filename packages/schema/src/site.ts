import type { PageSchema } from './page.js'
import type { VerticalId } from './vertical.js'

export interface NavItem {
  label: string
  url: string
  children?: NavItem[]
}

export interface BrandColors {
  primary: string
  secondary?: string
  accent?: string
  background?: string
  text?: string
}

/** Contact / location shown in the global footer (from site chrome extraction). */
export interface SiteFooterInfo {
  phone?: string
  email?: string
  address?: string
}

/**
 * Optional knobs for `generateSite` output. Omitted keys use built-in defaults.
 * Add fields here as new layout or copy rules are generalized.
 */
export interface SiteGeneratorPreferences {
  /** Cap nav items in Navbar + Footer (default 7). */
  navMaxItems?: number
  /** Skip synthesizing a hero on the homepage even when none was extracted (default: false). */
  noHero?: boolean
}

/** What an image on the original site is: the logo, a small icon or graphic, or a content photo. */
export type SiteImageKind = 'logo' | 'icon' | 'photo'

/** One image found on the original site, so generators can reuse real photos and the logo. */
export interface SiteImage {
  url: string
  alt?: string
  // Intrinsic or rendered size when the page or URL states it
  width?: number
  height?: number
  kind: SiteImageKind
  pageUrl: string
  // Order on its page, from the top
  order: number
}

export interface SiteSchema {
  rootUrl: string
  siteName: string
  tagline?: string
  brandColors: BrandColors
  faviconUrl?: string
  logoUrl?: string
  /** Photo picked for the home hero from the site's own images. */
  heroImageUrl?: string
  /** Images found across the crawled pages, logo and icons included, deduplicated. */
  images?: SiteImage[]
  nav: NavItem[]
  pages: PageSchema[]
  /** Site-wide footer contact block; drives `Footer` props in generated layout. */
  footer?: SiteFooterInfo
  /** Codegen preferences (does not affect crawl/extract). */
  generator?: SiteGeneratorPreferences
  /** What the business does; picks the generators' design profile. Detected when not set. */
  vertical?: VerticalId
}
