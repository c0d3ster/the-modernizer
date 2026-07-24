import type { SiteSchema, NavItem } from '@modernizer/schema'
import { unwrapWaybackUrl } from './wayback-utils.js'

const toRelative = (url: string, baseUrl: string): string | null => {
  if (!url || url === '#') return null
  try {
    const resolvedBase = unwrapWaybackUrl(baseUrl)
    const origin = new URL(resolvedBase).origin
    const parsed = new URL(unwrapWaybackUrl(url), resolvedBase)
    if (parsed.origin === origin) return parsed.pathname.replace(/\/$/, '') || '/'
    return url
  } catch {
    return null
  }
}

const isExternalHref = (href: string, baseUrl: string): boolean => {
  try {
    const resolvedBase = unwrapWaybackUrl(baseUrl)
    return new URL(unwrapWaybackUrl(href), resolvedBase).origin !== new URL(resolvedBase).origin
  } catch {
    return false
  }
}

const MAX_CHILDREN_PER_GROUP = 5

/**
 * Builds a clean nav tree from the raw schema nav:
 * - strips homepage (/) from all items — always reachable via the logo
 * - dedupes children across groups by URL (first occurrence wins)
 * - same-origin children: only links to crawled pages; external child links are kept as-is
 * - top-level same-origin links must target a crawled page; external top-level links are kept
 * - collapses single-child groups into a top-level link (dropdown with one item is just friction)
 * - caps children per group at MAX_CHILDREN_PER_GROUP
 * - caps total top-level items at navMaxItems
 */
export const buildNav = (nav: NavItem[], rootUrl: string, pagePathnames: Set<string>, navMaxItems: number): NavItem[] => {
  const resolvedRootUrl = unwrapWaybackUrl(rootUrl)
  const origin = new URL(resolvedRootUrl).origin
  const seenUrls = new Set<string>(['/', '']) // pre-seed homepage so it's always excluded

  const processChild = (child: NavItem): NavItem | null => {
    const childUrl = toRelative(child.url, rootUrl)
    if (!childUrl) return null
    let internalPath: string | null = null
    try {
      const p = new URL(unwrapWaybackUrl(child.url), resolvedRootUrl)
      if (p.origin === origin) internalPath = p.pathname.replace(/\/$/, '') || '/'
    } catch {
      return null
    }
    if (internalPath !== null && !pagePathnames.has(internalPath)) return null
    if (seenUrls.has(childUrl)) return null
    seenUrls.add(childUrl)
    return { label: child.label, url: childUrl }
  }

  const processItem = (item: NavItem): NavItem | NavItem[] | null => {
    const url = toRelative(item.url, rootUrl)
    const children = item.children
      ?.map(processChild)
      .filter((c): c is NavItem => c !== null)
      .slice(0, MAX_CHILDREN_PER_GROUP)

    const hasRealUrl =
      !!url &&
      url !== '#' &&
      !seenUrls.has(url) &&
      (pagePathnames.has(url) || isExternalHref(item.url, rootUrl))
    const hasChildren = children && children.length > 0

    if (!hasRealUrl && !hasChildren) return null

    // Single-child group: keep parent label but link directly to the one child (no dropdown)
    if (!hasRealUrl && children?.length === 1) return { label: item.label, url: children[0]!.url }

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
  const seen = new Set<string>()
  const result: Array<{ label: string; url: string }> = []
  const collect = (item: NavItem): void => {
    const url = toRelative(item.url, rootUrl)
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
  const resolvedRootUrl = unwrapWaybackUrl(rootUrl)
  const pagePathnames = new Set(
    pages.map((p) => {
      try {
        return new URL(unwrapWaybackUrl(p.url), resolvedRootUrl).pathname.replace(/\/$/, '') || '/'
      } catch {
        return p.url
      }
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

export { generateGlobalsCss } from '@modernizer/generator-config'
