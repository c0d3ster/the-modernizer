import { siteSchemaSchema } from '@modernizer/schema'
import type { SiteSchema } from '@modernizer/schema'
import { writeFile } from 'node:fs/promises'

import { stripChrome } from './chrome-stripper.js'
import { extractMetadata } from './metadata-extractor.js'
import { splitBlocks } from './block-splitter.js'
import { classifyBlocks } from './block-classifier.js'
import { extractSiteData } from './site-extractor.js'
import type { CrawlResult } from '@modernizer/schema'

export interface ExtractOptions {
  outputPath?: string
}

export const extract = async (
  crawlResults: CrawlResult[],
  options: ExtractOptions = {}
): Promise<SiteSchema> => {
  const rootUrl = crawlResults[0]?.url ?? ''

  // --- deterministic passes ---
  const { contentHtml, chromeHtml } = stripChrome(
    crawlResults.map((r) => ({ url: r.url, rawHtml: r.rawHtml }))
  )

  // --- LLM: site-level data from chrome (1 call) ---
  const siteData = await extractSiteData(chromeHtml, rootUrl)

  // --- LLM: per-page block classification (1 call per page) ---
  const pages = await Promise.all(
    crawlResults.map(async (result) => {
      const html = contentHtml[result.url] ?? result.rawHtml
      const metadata = extractMetadata(result.rawHtml, result.url)
      const rawBlocks = splitBlocks(html)
      const { archetype, blocks } = await classifyBlocks(metadata.title, rawBlocks)

      return {
        url: result.finalUrl,
        title: metadata.title,
        archetype,
        ...(metadata.metaDescription && { metaDescription: metadata.metaDescription }),
        blocks,
      }
    })
  )

  const siteSchema = {
    rootUrl,
    siteName: siteData.siteName,
    ...(siteData.tagline && { tagline: siteData.tagline }),
    brandColors: siteData.brandColors,
    nav: siteData.nav,
    pages,
  }

  // validate the whole thing before returning
  const validated = siteSchemaSchema.parse(siteSchema)

  if (options.outputPath) {
    await writeFile(options.outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  }

  return validated
}
