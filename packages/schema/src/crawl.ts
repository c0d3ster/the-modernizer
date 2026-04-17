export type FetchMethod = 'static' | 'playwright'

export interface CrawlResult {
  url: string
  finalUrl: string
  title: string
  rawHtml: string
  statusCode: number
  fetchMethod: FetchMethod
  images: string[]
  assets: string[]
  internalLinks: string[]
  crawledAt: string
}

export interface CrawlOptions {
  maxPages?: number
  maxDepth?: number
  concurrency?: number
  delayMs?: number
  respectRobotsTxt?: boolean
  /**
   * When true, run Playwright’s Chromium in headless mode (CI, Docker, SSH).
   * When omitted, uses boolean env MODERNIZER_HEADLESS; defaults to headful (false).
   */
  playwrightHeadless?: boolean
}
