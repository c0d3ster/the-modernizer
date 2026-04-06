import { navItemSchema, brandColorsSchema } from '@modernizer/schema'
import type { NavItem, BrandColors } from '@modernizer/schema'
import { z } from 'zod'

import { callLlm, parseJsonResponse } from './llm-client.js'
import { extractSitePrompt } from './prompts/extract-site.js'

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
})

const siteExtractionResponseSchema = z.object({
  siteName: z.string(),
  tagline: z.string().optional(),
  brandColors: brandColorsSchema,
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
  const raw = await callLlm(prompt)
  const parsed = parseJsonResponse<unknown>(raw)
  const validated = siteExtractionResponseSchema.parse(parsed)

  return {
    siteName: validated.siteName,
    tagline: validated.tagline,
    brandColors: validated.brandColors,
    nav: validated.nav as NavItem[],
    footerPhone: validated.footer?.phone,
    footerEmail: validated.footer?.email,
    footerAddress: validated.footer?.address,
  }
}
