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

// The model sometimes answers with a candidate's label ("inline-style (#950e12)") instead of the hex
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i
export const hexIn = (value: string | undefined): string | undefined => (value ? HEX.exec(value)?.[0]?.toLowerCase() : undefined)

const hexColors = (colors: Partial<Record<keyof BrandColors, string>>): Partial<BrandColors> =>
  Object.fromEntries(Object.entries(colors).flatMap(([key, value]) => {
    const hex = hexIn(value)
    return hex ? [[key, hex]] : []
  }))

export const extractSiteData = async (
  chromeHtml: string,
  rootUrl: string,
  colorCandidates: ColorCandidate[] = [],
  // The color the rendered page shows most on buttons and the header; beats any CSS-text guess
  renderedPrimary?: string
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
  const FALLBACK_BLUE = '#2563eb'
  const isFallbackBlue = (hex?: string): boolean => hex?.toLowerCase() === FALLBACK_BLUE
  const topCandidate = colorCandidates.find(
    (c) => !isFallbackBlue(c.hex) && (c.confidence === 'high' || c.confidence === 'medium')
  )
  const llmPrimary = validated.brandColors?.primary
  const primary = renderedPrimary ??
    (llmPrimary && !isFallbackBlue(llmPrimary)
      ? llmPrimary
      : (topCandidate?.hex ?? FALLBACK_BLUE))

  if (renderedPrimary) console.log(`  [color] primary from the rendered page: ${renderedPrimary}`)
  else if (topCandidate && (!llmPrimary || isFallbackBlue(llmPrimary))) {
    console.log(`  [color] LLM returned no primary color — using top candidate: ${topCandidate.label} (${topCandidate.hex})`)
  }

  return {
    siteName: validated.siteName,
    tagline: validated.tagline,
    brandColors: {
      ...hexColors(validated.brandColors ?? {}),
      primary: hexIn(primary) ?? FALLBACK_BLUE,
      background: hexIn(validated.brandColors?.background) ?? '#f4f1ec',
    },
    nav: validated.nav,
    footerPhone: validated.footer?.phone,
    footerEmail: validated.footer?.email,
    footerAddress: validated.footer?.address,
  }
}
