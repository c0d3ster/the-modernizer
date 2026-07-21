// Schemas built from Wayback Machine captures carry the archive's wrapper URL
// (web.archive.org/web/{timestamp}/{original-url}) rather than the site's own URL. Route and
// nav-matching logic must compare original site paths, not wrapper paths — comparing wrapper
// paths directly fails even after unwrapping segments, because each page can be captured at a
// different Wayback timestamp than the nav item that links to it.
const WAYBACK_URL_PATTERN = /^https?:\/\/web\.archive\.org\/web\/\d{1,14}[a-z_]*\/(https?:\/\/.+)$/i

export const unwrapWaybackUrl = (url: string): string => url.match(WAYBACK_URL_PATTERN)?.[1] ?? url
