import { navItemSchema, brandColorsSchema } from '@modernizer/schema'
import type { NavItem, BrandColors } from '@modernizer/schema'
import { z } from 'zod'

import { callLlmWithTool } from './llm-client.js'
import { extractSitePrompt, extractSiteTool } from './prompts/extract-site.js'

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
  rootUrl: string
): Promise<SiteExtractionResult> => {
  const prompt = extractSitePrompt(chromeHtml, rootUrl)
  const toolResult = await callLlmWithTool<unknown>(prompt, extractSiteTool)

  const result = siteExtractionResponseSchema.safeParse(toolResult)
  if (!result.success) {
    console.error('site extraction: schema validation failed', result.error.flatten())
    throw result.error
  }
  const validated = result.data

  return {
    siteName: validated.siteName,
    tagline: validated.tagline,
    brandColors: validated.brandColors ?? { primary: '#000000' },
    nav: validated.nav,
    footerPhone: validated.footer?.phone,
    footerEmail: validated.footer?.email,
    footerAddress: validated.footer?.address,
  }
}
