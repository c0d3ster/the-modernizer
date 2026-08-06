import type { NavItem } from '@modernizer/schema'

const WAYBACK_URL_PATTERN = /^https?:\/\/web\.archive\.org\/web\/\d{1,14}[a-z_]*\/(https?:\/\/.+)$/i

export const unwrapWaybackUrl = (url: string): string => url.match(WAYBACK_URL_PATTERN)?.[1] ?? url

export const urlToRoutePath = (url: string, baseUrl: string): string => {
  const resolvedUrl = unwrapWaybackUrl(url)
  const resolvedBase = unwrapWaybackUrl(baseUrl)
  const { pathname } = new URL(resolvedUrl, resolvedBase)
  const clean = pathname.replace(/\/$/, '')
  return clean || '/'
}

export const routePathToFilePath = (routePath: string): string =>
  routePath === '/' ? 'src/app/page.tsx' : `src/app${routePath}/page.tsx`

/**
 * Nav URLs come out of extraction as absolute URLs against the original live site
 * (e.g. https://edgehillrecovery.org/about). Rewrites them to local route paths so the
 * generated Navbar links to the Next.js app's own routes instead of the original site.
 * External links (different origin than rootUrl) are left untouched.
 */
export const relativizeNavItems = (nav: NavItem[], rootUrl: string): NavItem[] => {
  const rootOrigin = new URL(unwrapWaybackUrl(rootUrl)).origin

  const relativizeOne = (item: NavItem): NavItem => {
    const resolvedUrl = unwrapWaybackUrl(item.url)
    const isSameOrigin = (() => {
      try {
        return new URL(resolvedUrl, rootUrl).origin === rootOrigin
      } catch {
        return false
      }
    })()

    return {
      ...item,
      url: isSameOrigin ? urlToRoutePath(item.url, rootUrl) : resolvedUrl,
      children: item.children ? item.children.map(relativizeOne) : undefined,
    }
  }

  return nav.map(relativizeOne)
}
