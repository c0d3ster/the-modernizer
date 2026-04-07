import { siteSchemaSchema } from '@modernizer/schema'
import type { SiteSchema } from '@modernizer/schema'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

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
  const seen = new Set<string>()
  const uniqueResults = crawlResults.filter((r) => {
    if (seen.has(r.finalUrl)) return false
    seen.add(r.finalUrl)
    return true
  })

  if (uniqueResults.length === 0) {
    throw new Error('Cannot extract: no crawl pages provided')
  }

  const first = uniqueResults[0]!
  const rootUrl = first.finalUrl || first.url

  // --- deterministic passes ---
  const { contentHtml, chromeHtml } = stripChrome(
    uniqueResults.map((r) => ({ url: r.url, rawHtml: r.rawHtml }))
  )

  // --- LLM: site-level data from chrome (1 call) ---
  const siteData = await extractSiteData(chromeHtml, rootUrl)

  // --- LLM: per-page block classification (1 call per page, sequential to respect rate limits) ---
  const pages = []
  for (const [i, result] of uniqueResults.entries()) {
    const html = contentHtml[result.url] ?? result.rawHtml
    const metadata = extractMetadata(result.rawHtml, result.url)
    const rawBlocks = splitBlocks(html)
    console.log(`  page ${i + 1}/${uniqueResults.length}: ${metadata.title} (${rawBlocks.length} blocks)`)
    const { archetype, blocks } = await classifyBlocks(metadata.title, rawBlocks)
    console.log(`    → ${archetype}, ${blocks.length} classified blocks`)

    pages.push({
      url: result.finalUrl,
      title: metadata.title,
      archetype,
      ...(metadata.metaDescription && { metaDescription: metadata.metaDescription }),
      blocks,
    })
  }

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
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, JSON.stringify(validated, null, 2), 'utf-8')
  }

  return validated
}
