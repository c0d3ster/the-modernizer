// Maps PageSchema URLs to Next.js App Router file paths and component names

import { unwrapWaybackUrl } from './wayback-utils.js'

/** Resolve page URLs that may be absolute or site-relative; `baseUrl` is typically `SiteSchema.rootUrl`. */
export const urlToRoutePath = (url: string, baseUrl?: string): string => {
  const resolvedUrl = unwrapWaybackUrl(url)
  const resolvedBase = baseUrl ? unwrapWaybackUrl(baseUrl) : baseUrl
  const { pathname } = resolvedBase ? new URL(resolvedUrl, resolvedBase) : new URL(resolvedUrl)
  const clean = pathname.replace(/\/+$/, '')
  if (!clean) return 'src/app/page.tsx'
  return `src/app${clean}/page.tsx`
}

export const urlToComponentName = (url: string, baseUrl?: string): string => {
  const resolvedUrl = unwrapWaybackUrl(url)
  const resolvedBase = baseUrl ? unwrapWaybackUrl(baseUrl) : baseUrl
  const { pathname } = resolvedBase ? new URL(resolvedUrl, resolvedBase) : new URL(resolvedUrl)
  const clean = pathname.replace(/\/+$/, '')
  if (!clean) return 'HomePage'
  // Capitalize each segment and each hyphenated word within it; prefix if the
  // segment would start with a digit (invalid JS identifier).
  const toPascal = (s: string): string => {
    const joined = s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    return /^\d/.test(joined) ? `_${joined}` : joined
  }
  return clean.split('/').filter(Boolean).map(toPascal).join('') + 'Page'
}
