import type { SiteSchema, BrandColors, NavItem } from '@modernizer/schema'

const toRelative = (url: string, origin: string): string | null => {
  if (!url || url === '#') return null
  try {
    const parsed = new URL(url)
    if (parsed.origin === origin) return parsed.pathname.replace(/\/$/, '') || '/'
    return url
  } catch {
    return url
  }
}

const MAX_CHILDREN_PER_GROUP = 5

/**
 * Builds a clean nav tree from the raw schema nav:
 * - strips homepage (/) from all items — always reachable via the logo
 * - dedupes children across groups by URL (first occurrence wins)
 * - filters children to only crawled pages
 * - collapses single-child groups into a top-level link (dropdown with one item is just friction)
 * - caps children per group at MAX_CHILDREN_PER_GROUP
 * - caps total top-level items at navMaxItems
 */
export const buildNav = (nav: NavItem[], rootUrl: string, pagePathnames: Set<string>, navMaxItems: number): NavItem[] => {
  const origin = new URL(rootUrl).origin
  const seenUrls = new Set<string>(['/', '']) // pre-seed homepage so it's always excluded

  const processChild = (child: NavItem): NavItem | null => {
    const childUrl = toRelative(child.url, origin)
    if (!childUrl) return null
    const isInternal = (() => { try { return new URL(child.url).origin === origin } catch { return false } })()
    if (isInternal && !pagePathnames.has(new URL(child.url).pathname.replace(/\/$/, '') || '/')) return null
    if (seenUrls.has(childUrl)) return null
    seenUrls.add(childUrl)
    return { label: child.label, url: childUrl }
  }

  const processItem = (item: NavItem): NavItem | NavItem[] | null => {
    const url = toRelative(item.url, origin)
    const children = item.children
      ?.map(processChild)
      .filter((c): c is NavItem => c !== null)
      .slice(0, MAX_CHILDREN_PER_GROUP)

    const hasRealUrl = url && url !== '#' && !seenUrls.has(url) && pagePathnames.has(url)
    const hasChildren = children && children.length > 0

    if (!hasRealUrl && !hasChildren) return null

    // Single-child group: promote the child to top-level, drop the wrapper
    if (!hasRealUrl && children?.length === 1) return children[0]!

    if (hasRealUrl) seenUrls.add(url)

    const result: NavItem = { label: item.label, url: url ?? '#' }
    if (hasChildren) result.children = children
    return result
  }

  return nav
    .flatMap((item) => {
      const result = processItem(item)
      if (result === null) return []
      return Array.isArray(result) ? result : [result]
    })
    .slice(0, navMaxItems)
}

/** @deprecated Use buildNav instead — flattenNav destroys hierarchy */
export const flattenNav = (nav: NavItem[], rootUrl: string): Array<{ label: string; url: string }> => {
  const origin = new URL(rootUrl).origin
  const seen = new Set<string>()
  const result: Array<{ label: string; url: string }> = []
  const collect = (item: NavItem): void => {
    const url = toRelative(item.url, origin)
    if (url && !seen.has(url)) { seen.add(url); result.push({ label: item.label, url }) }
    item.children?.forEach(collect)
  }
  nav.forEach(collect)
  return result
}

/**
 * Root layout codegen. Extend `SiteSchema.footer` / `SiteSchema.generator` to change
 * Footer contact props and nav cap without editing this file’s string shape for one-offs.
 */
export const generateLayout = (schema: SiteSchema): string => {
  const { siteName, nav, tagline, rootUrl, pages } = schema
  const navMaxItems = schema.generator?.navMaxItems ?? 7
  const pagePathnames = new Set(
    pages.map((p) => {
      try { return new URL(p.url).pathname.replace(/\/$/, '') || '/' } catch { return p.url }
    })
  )
  const builtNav = buildNav(nav, rootUrl, pagePathnames, navMaxItems)
  const navLiteral = JSON.stringify(builtNav, null, 2)
  const description = tagline ?? siteName

  const footerProps: string[] = []
  if (schema.footer?.phone) footerProps.push(`phone={${JSON.stringify(schema.footer.phone)}}`)
  if (schema.footer?.email) footerProps.push(`email={${JSON.stringify(schema.footer.email)}}`)
  if (schema.footer?.address) footerProps.push(`address={${JSON.stringify(schema.footer.address)}}`)
  const footerPropsStr = footerProps.length > 0 ? ` ${footerProps.join(' ')}` : ''

  return `import type { ReactElement, ReactNode } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

export const metadata = {
  title: ${JSON.stringify(siteName)},
  description: ${JSON.stringify(description)},
}

const nav = ${navLiteral}

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => {
  return (
    <html lang='en'>
      <body>
        <Navbar siteName={${JSON.stringify(siteName)}} nav={nav} />
        {children}
        <Footer siteName={${JSON.stringify(siteName)}} nav={nav}${footerPropsStr} />
      </body>
    </html>
  )
}

export default RootLayout
`
}

/** Warm neutral when the schema does not specify a page background (avoids harsh #fff). */
const DEFAULT_PAGE_BACKGROUND = '#f4f1ec'

/** Only emit values that are plausible CSS colors; avoids broken or hostile input in generated CSS. */
const sanitizeThemeColor = (value: string | undefined, fallback: string): string => {
  if (value == null || typeof value !== 'string') return fallback
  const t = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t
  if (/^(?:rgb|hsl|oklch|hwb|lab|lch)\(/i.test(t)) return t
  return fallback
}

export const generateGlobalsCss = (brandColors: BrandColors): string => {
  const primary = sanitizeThemeColor(brandColors.primary, '#2563eb')
  const primaryForeground = sanitizeThemeColor(brandColors.text, '#ffffff')
  const background = sanitizeThemeColor(brandColors.background, DEFAULT_PAGE_BACKGROUND)

  return `@import "tailwindcss";
@source "../";

/* Accordion keyframes (Radix UI) */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

@theme {
  --color-primary: ${primary};
  --color-primary-foreground: ${primaryForeground};

  --color-background: ${background};
  --color-foreground: #1c1917;

  --color-muted: #e8e5e0;
  --color-muted-foreground: #57534e;

  --color-card: #fffdfb;
  --color-card-foreground: #1c1917;

  --color-popover: #fffdfb;
  --color-popover-foreground: #1c1917;

  --color-border: #e0d9d0;
  --color-input: #e0d9d0;
  --color-ring: ${primary};

  --color-accent: #ece8e2;
  --color-accent-foreground: #1c1917;

  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;

  --radius: 0.5rem;
  --radius-sm: calc(0.5rem - 2px);
  --radius-md: calc(0.5rem - 2px);
  --radius-lg: 0.5rem;
  --radius-xl: calc(0.5rem + 4px);

  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
`
}
