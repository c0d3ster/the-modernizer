// Site crawler: discovers and fetches all pages on a target site

export { crawl } from './crawler.js'
export { resolvePlaywrightHeadless } from './playwright-fetcher.js'
export { sampleRenderedColors } from './rendered-colors.js'
export type { ColorSample } from './rendered-colors.js'
export { staticFetch } from './static-fetcher.js'
export type { StaticFetchResult } from './static-fetcher.js'
export {
  normalizeUrl,
  isSameDomain,
  isAssetUrl,
  isInfrastructureUrl,
  isNavigableUrl,
  deduplicateUrls,
  unwrapWaybackUrl,
} from './url-utils.js'
export { extractLinks, extractImages, extractTitle } from './link-extractor.js'
export type { CrawlResult, CrawlOptions, FetchMethod } from './types.js'
