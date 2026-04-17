export type { FetchMethod, CrawlResult } from '@modernizer/schema'
import type { CrawlResult } from '@modernizer/schema'
import type { CrawlOptions as BaseCrawlOptions } from '@modernizer/schema'

export interface CrawlOptions extends BaseCrawlOptions {
  onPageCrawled?: (result: CrawlResult, total: number) => void
}
