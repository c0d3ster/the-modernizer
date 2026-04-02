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

export interface SiteSchema {
  rootUrl: string
  siteName: string
  tagline?: string
  brandColors: BrandColors
  faviconUrl?: string
  logoUrl?: string
  nav: NavItem[]
  pages: PageSchema[]
}
