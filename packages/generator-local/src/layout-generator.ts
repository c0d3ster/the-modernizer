import type { SiteSchema, NavItem } from '@modernizer/schema'
import { unwrapWaybackUrl } from './wayback-utils.js'
import { fontSetup, generateMetadataExport } from '@modernizer/generator-config'
import type { SiteStyle } from './site-style.js'

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

const NAV_LABEL_MAX = 24
const TITLE_SEPARATOR = /\s+[|–—-]\s+/

/** "contact.html" -> "Contact", "frame-repair" -> "Frame Repair" */
const labelFromPath = (path: string): string =>
  (path.split('/').filter(Boolean).pop() ?? '')
    .replace(/\.[a-z]{2,5}$/i, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

/** Cuts at a word boundary so the label fits a menu. */
const fitLabel = (label: string): string => {
  if (label.length <= NAV_LABEL_MAX) return label
  const words = label.split(' ')
  while (words.length > 1 && words.join(' ').length > NAV_LABEL_MAX) words.pop()
  return words.join(' ')
}

/**
 * A short menu label for a page when the site's own menu wasn't extracted. Page titles carry the
 * business name and SEO phrases ("Urgent Care - MEADOW BRANCH ANIMAL HOSPITAL"), so the name is
 * dropped, and a title still too long for a menu gives way to the page's URL slug.
 */
export const navLabelFor = (title: string, path: string, siteName: string): string => {
  const name = siteName.toLowerCase()
  const parts = title.split(TITLE_SEPARATOR).map((t) => t.trim()).filter((t) => t && !t.toLowerCase().includes(name) && !name.includes(t.toLowerCase()))
  const fromTitle = parts[0] ?? ''
  if (fromTitle && fromTitle.length <= NAV_LABEL_MAX) return fromTitle
  return labelFromPath(path) || fitLabel(fromTitle)
}

/** Words most labels start or end with ("Winchester ... Attorney") say nothing in a menu. */
const dropSharedEdgeWords = (labels: readonly string[]): string[] => {
  if (labels.length < 3) return [...labels]
  const share = (pick: (words: string[]) => string | undefined): string | undefined => {
    const counts = new Map<string, number>()
    for (const l of labels) {
      const w = pick(l.split(' '))?.toLowerCase()
      if (w) counts.set(w, (counts.get(w) ?? 0) + 1)
    }
    const [word, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    return word && count !== undefined && count / labels.length >= 0.6 ? word : undefined
  }
  const first = share((w) => w[0])
  const last = share((w) => w[w.length - 1])
  return labels.map((label) => {
    const words = label.split(' ')
    const trimmed = words.filter((w, i) => !((i === 0 && w.toLowerCase() === first) || (i === words.length - 1 && w.toLowerCase() === last)))
    return trimmed.length ? trimmed.join(' ') : label
  })
}

// Legal and utility pages that belong in the footer, not the menu
const NOT_IN_MENU = /privacy|terms|\btou\b|sitemap|accessibility|disclaimer|cookie/i

/**
 * The menu to build from: the extracted one, or, when extraction found none, the crawled pages in
 * crawl order (home excluded, since the logo links there).
 */
export const navSource = ({ nav, pages, rootUrl, siteName }: Pick<SiteSchema, 'nav' | 'pages' | 'rootUrl' | 'siteName'>): NavItem[] => {
  if (nav.length) return nav
  const root = unwrapWaybackUrl(rootUrl)
  const items = pages.flatMap((p) => {
    try {
      const path = new URL(unwrapWaybackUrl(p.url), root).pathname.replace(/\/$/, '') || '/'
      if (path === '/' || !p.title || NOT_IN_MENU.test(`${path} ${p.title}`)) return []
      return [{ label: navLabelFor(p.title, path, siteName), url: p.url }]
    } catch {
      return []
    }
  })
  const labels = dropSharedEdgeWords(items.map((i) => i.label)).map(fitLabel)
  return items.map((item, i) => ({ ...item, label: labels[i] ?? item.label }))
}

// Characters of menu text that fit beside the logo and buttons at small-laptop width (1366px)
const NAV_CHAR_BUDGET = 64

/** How many top-level links to show before the rest go under "More". */
export const visibleNavCount = (labels: readonly string[], max = 6): number => {
  let used = 0
  for (const [i, label] of labels.slice(0, max).entries()) {
    used += label.length + 4
    if (used > NAV_CHAR_BUDGET) return Math.max(2, i)
  }
  return Math.min(labels.length, max)
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
export const generateLayout = (schema: SiteSchema, style?: SiteStyle): string => {
  const { siteName, rootUrl, pages } = schema
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
  const builtNav = buildNav(navSource(schema), rootUrl, pagePathnames, navMaxItems)
  const navLiteral = JSON.stringify(builtNav, null, 2)

  const footerProps: string[] = []
  if (schema.footer?.phone) footerProps.push(`phone={${JSON.stringify(schema.footer.phone)}}`)
  if (schema.footer?.email) footerProps.push(`email={${JSON.stringify(schema.footer.email)}}`)
  if (schema.footer?.address) footerProps.push(`address={${JSON.stringify(schema.footer.address)}}`)
  const footerPropsStr = footerProps.length > 0 ? ` ${footerProps.join(' ')}` : ''

  // The vertical's fonts, main action and header phone; without a style, the plain shell
  const fonts = style ? fontSetup(style.profile) : null
  const navProps: string[] = []
  if (schema.logoUrl) navProps.push(`logoUrl={${JSON.stringify(schema.logoUrl)}}`)
  // A main action that only dials the number would sit beside the same number as the phone button
  const ctaDuplicatesPhone = Boolean(style?.headerPhone && style.primaryAction?.url.startsWith('tel:'))
  if (style?.primaryAction && !ctaDuplicatesPhone) navProps.push(`ctaText={${JSON.stringify(style.primaryAction.text)}}`, `ctaUrl={${JSON.stringify(style.primaryAction.url)}}`)
  if (style?.headerPhone) navProps.push(`phone={${JSON.stringify(style.headerPhone)}}`)
  navProps.push(`maxVisible={${visibleNavCount(builtNav.map((n) => n.label))}}`)
  const navPropsStr = navProps.length > 0 ? ` ${navProps.join(' ')}` : ''

  return `import type { ReactElement, ReactNode } from 'react'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import type { NavItem } from '@/types/schema'
${fonts ? `${fonts.imports}
` : ''}import './globals.css'
${fonts ? `
${fonts.declarations}
` : ''}
${generateMetadataExport(schema)}

const nav: NavItem[] = ${navLiteral}

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => {
  return (
    <html lang='en'${fonts ? ` className={${fonts.className}}` : ''}>
      <body>
        <Navbar siteName={${JSON.stringify(siteName)}} nav={nav}${navPropsStr} />
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
