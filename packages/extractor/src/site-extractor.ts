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
  const raw = await callLlm(prompt)
  const parsed = parseJsonResponse<unknown>(raw)

  const result = siteExtractionResponseSchema.safeParse(parsed)
  if (!result.success) {
    const preview = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw
    console.error('site extraction: schema validation failed', result.error.flatten())
    console.error('raw response (preview):', preview)
    throw result.error
  }
  const validated = result.data

  return {
    siteName: validated.siteName,
    tagline: validated.tagline,
    brandColors: validated.brandColors ?? { primary: '#000000' },
    nav: validated.nav as NavItem[],
    footerPhone: validated.footer?.phone,
    footerEmail: validated.footer?.email,
    footerAddress: validated.footer?.address,
  }
}
