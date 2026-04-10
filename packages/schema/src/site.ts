import type { PageSchema } from './page.js'

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
  /** Cap flattened nav items in Navbar + Footer (default 7). */
  navMaxItems?: number
}

export interface SiteSchema {
  rootUrl: string
  siteName: string
  tagline?: string
  brandColors: BrandColors
  faviconUrl?: string
  logoUrl?: string
  nav: NavItem[]
  pages: PageSchema[]
  /** Site-wide footer contact block; drives `Footer` props in generated layout. */
  footer?: SiteFooterInfo
  /** Codegen preferences (does not affect crawl/extract). */
  generator?: SiteGeneratorPreferences
}
