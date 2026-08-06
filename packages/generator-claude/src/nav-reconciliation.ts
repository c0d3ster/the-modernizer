import type { NavItem, PageSchema } from '@modernizer/schema'
import { urlToRoutePath } from './route-utils.js'

const isLocalRoutePath = (url: string): boolean => url.startsWith('/')

const firstSegment = (routePath: string): string | undefined => routePath.split('/')[1] || undefined

const titleCaseFromSegment = (segment: string): string =>
  segment.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

/**
 * Reconciles the extracted nav tree against the pages that actually got crawled. Nav is
 * extracted from the site's own <nav> menu HTML; pages come from crawling independently — they
 * can drift out of sync, which surfaces as two distinct bugs in the generated site:
 *
 *  - Dead links: a nav entry whose target was never crawled as a page 404s once generated. A
 *    leaf item with no matching page is dropped. A parent whose own link is dead but that still
 *    has at least one surviving child keeps the group, re-pointing its own link at that child
 *    instead of a nonexistent section-index page.
 *  - Orphaned pages: a page that got crawled but isn't reachable from any nav entry is
 *    unreachable in the generated site except by typing its URL directly. These are appended to
 *    nav — merged into an existing top-level entry that shares their first path segment if one
 *    exists, otherwise grouped into a new synthesized entry (or added standalone if there's only
 *    one orphan for that segment).
 */
export const reconcileNav = (nav: NavItem[], pages: PageSchema[], rootUrl: string): NavItem[] => {
  const routePathOf = (url: string): string => urlToRoutePath(url, rootUrl)
  const pageRoutePaths = new Set(pages.map((p) => routePathOf(p.url)))

  const reconcileItem = (item: NavItem): NavItem | undefined => {
    const children = item.children?.map(reconcileItem).filter((child): child is NavItem => child !== undefined)
    const ownUrlIsValid = !isLocalRoutePath(item.url) || pageRoutePaths.has(item.url)

    if (ownUrlIsValid) return { ...item, children: children?.length ? children : undefined }

    const [firstChild] = children ?? []
    if (firstChild) return { ...item, url: firstChild.url, children }
    return undefined
  }

  const reconciled = nav.map(reconcileItem).filter((item): item is NavItem => item !== undefined)

  const linkedPaths = new Set<string>()
  const collectLinkedPaths = (items: NavItem[]): void => {
    for (const item of items) {
      if (isLocalRoutePath(item.url)) linkedPaths.add(item.url)
      if (item.children) collectLinkedPaths(item.children)
    }
  }
  collectLinkedPaths(reconciled)

  const orphanedPages = pages.filter((p) => {
    const routePath = routePathOf(p.url)
    return routePath !== '/' && !linkedPaths.has(routePath)
  })

  const orphansBySegment = new Map<string, PageSchema[]>()
  for (const page of orphanedPages) {
    const segment = firstSegment(routePathOf(page.url))
    if (!segment) continue
    orphansBySegment.set(segment, [...(orphansBySegment.get(segment) ?? []), page])
  }

  const mergedSegments = new Set<string>()
  const withMergedOrphans = reconciled.map((item) => {
    if (!isLocalRoutePath(item.url)) return item
    const segment = firstSegment(item.url)
    const orphansForSegment = segment ? orphansBySegment.get(segment) : undefined
    if (!segment || !orphansForSegment) return item

    mergedSegments.add(segment)
    const newChildren = orphansForSegment.map((p) => ({ label: p.title, url: routePathOf(p.url) }))
    return { ...item, children: [...(item.children ?? []), ...newChildren] }
  })

  const newGroups: NavItem[] = []
  for (const [segment, orphans] of orphansBySegment) {
    if (mergedSegments.has(segment)) continue

    const children = orphans.map((p) => ({ label: p.title, url: routePathOf(p.url) }))
    const [firstChild] = children
    if (!firstChild) continue

    newGroups.push(
      children.length > 1
        ? { label: titleCaseFromSegment(segment), url: firstChild.url, children }
        : { label: firstChild.label, url: firstChild.url }
    )
  }

  return [...withMergedOrphans, ...newGroups]
}
