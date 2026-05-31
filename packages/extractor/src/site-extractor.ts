import { navItemSchema, brandColorsSchema } from '@modernizer/schema'
import type { NavItem, BrandColors } from '@modernizer/schema'
import { z } from 'zod'

import { callLlmWithTool } from './llm-client.js'
import { extractSitePrompt, extractSiteTool } from './prompts/extract-site.js'
import type { ColorCandidate } from './color-extractor.js'

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
})

const siteExtractionResponseSchema = z.object({
  siteName: z.string(),
  tagline: z.string().optional(),
  brandColors: brandColorsSchema.optional(),
  nav: z.array(navItemSchema),
  footer: z
    .object({
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      socialLinks: z.array(socialLinkSchema).optional(),
    })
    .optional(),
})

export interface SiteExtractionResult {
  siteName: string
  tagline?: string
  brandColors: BrandColors
  nav: NavItem[]
  footerPhone?: string
  footerEmail?: string
  footerAddress?: string
}

export const extractSiteData = async (
  chromeHtml: string,
  rootUrl: string,
  colorCandidates: ColorCandidate[] = []
): Promise<SiteExtractionResult> => {
  const prompt = extractSitePrompt(chromeHtml, rootUrl, colorCandidates)
  const toolResult = await callLlmWithTool<unknown>(prompt, extractSiteTool)

  const result = siteExtractionResponseSchema.safeParse(toolResult)
  if (!result.success) {
    console.error('site extraction: schema validation failed', result.error.flatten())
    throw result.error
  }
  const validated = result.data

  // If the LLM returned no brand colors or fell back to generic blue, use the
  // top color candidate instead. The extractor has already ranked candidates by
  // confidence so the first entry is the most reliable signal we have.
  const FALLBACK_BLUE = '`#2563eb`'
  const isFallbackBlue = (hex?: string): boolean => hex?.toLowerCase() === FALLBACK_BLUE
  const topCandidate = colorCandidates.find(
    (c) => !isFallbackBlue(c.hex) && (c.confidence === 'high' || c.confidence === 'medium')
  )
  const llmPrimary = validated.brandColors?.primary
  const primary =
    llmPrimary && !isFallbackBlue(llmPrimary)
      ? llmPrimary
      : (topCandidate?.hex ?? FALLBACK_BLUE)

  if (topCandidate && (!llmPrimary || isFallbackBlue(llmPrimary))) {
    console.log(`  [color] LLM returned no primary color — using top candidate: ${topCandidate.label} (${topCandidate.hex})`)
  }

  return {
    siteName: validated.siteName,
    tagline: validated.tagline,
    brandColors: {
      ...(validated.brandColors ?? {}),
      primary,
      background: validated.brandColors?.background ?? '#f4f1ec',
    },
    nav: validated.nav,
    footerPhone: validated.footer?.phone,
    footerEmail: validated.footer?.email,
    footerAddress: validated.footer?.address,
  }
}
