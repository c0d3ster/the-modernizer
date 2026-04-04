const ASSET_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif',
  '.mp4', '.mov', '.avi', '.webm', '.mp3', '.wav',
  '.woff', '.woff2', '.ttf', '.eot',
  '.css', '.js', '.map',
  '.xml', '.json', '.csv',
])

export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.hash = ''
    // strip trailing slash from pathname unless it's just '/'
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export const isSameDomain = (url: string, rootUrl: string): boolean => {
  try {
    const parsed = new URL(url)
    const root = new URL(rootUrl)
    return parsed.hostname === root.hostname
  } catch {
    return false
  }
}

export const isAssetUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    const ext = parsed.pathname.slice(parsed.pathname.lastIndexOf('.')).toLowerCase()
    return ASSET_EXTENSIONS.has(ext)
  } catch {
    return false
  }
}

export const isNavigableUrl = (url: string, rootUrl: string): boolean => {
  if (!url || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return false
  }
  if (url.startsWith('#')) return false
  if (!isSameDomain(url, rootUrl)) return false
  if (isAssetUrl(url)) return false
  return true
}

export const deduplicateUrls = (urls: string[]): string[] =>
  [...new Set(urls.map(normalizeUrl))]
