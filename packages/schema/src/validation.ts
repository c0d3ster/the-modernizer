import { z } from 'zod'

import { PageArchetype } from './page.js'

// --- Block schemas ---

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  heading: z.string(),
  subheading: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
})

export const textSectionBlockSchema = z.object({
  type: z.literal('text_section'),
  heading: z.string().optional(),
  body: z.string(),
})

export const featureGridBlockSchema = z.object({
  type: z.literal('feature_grid'),
  heading: z.string().optional(),
  features: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      iconUrl: z.string().optional(),
    })
  ),
})

export const testimonialBlockSchema = z.object({
  type: z.literal('testimonial'),
  heading: z.string().optional(),
  testimonials: z.array(
    z.object({
      quote: z.string(),
      author: z.string(),
      role: z.string().optional(),
      avatarUrl: z.string().optional(),
    })
  ),
})

export const teamGridBlockSchema = z.object({
  type: z.literal('team_grid'),
  heading: z.string().optional(),
  members: z.array(
    z.object({
      name: z.string(),
      role: z.string().optional(),
      bio: z.string().optional(),
      photoUrl: z.string().optional(),
    })
  ),
})

export const ctaBlockSchema = z.object({
  type: z.literal('cta'),
  heading: z.string(),
  subheading: z.string().optional(),
  ctaText: z.string(),
  ctaUrl: z.string(),
})

export const contactInfoBlockSchema = z.object({
  type: z.literal('contact_info'),
  heading: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  mapEmbedUrl: z.string().optional(),
})

export const faqBlockSchema = z.object({
  type: z.literal('faq'),
  heading: z.string().optional(),
  items: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
})

export const statsBlockSchema = z.object({
  type: z.literal('stats'),
  heading: z.string().optional(),
  stats: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  ),
})

export const imageGalleryBlockSchema = z.object({
  type: z.literal('image_gallery'),
  heading: z.string().optional(),
  images: z.array(
    z.object({
      url: z.string(),
      alt: z.string().optional(),
      caption: z.string().optional(),
    })
  ),
})

export const pricingTableBlockSchema = z.object({
  type: z.literal('pricing_table'),
  heading: z.string().optional(),
  tiers: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      description: z.string().optional(),
      features: z.array(z.string()),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
    })
  ),
})

export const logoCloudBlockSchema = z.object({
  type: z.literal('logo_cloud'),
  heading: z.string().optional(),
  logos: z.array(
    z.object({
      name: z.string(),
      imageUrl: z.string(),
      url: z.string().optional(),
    })
  ),
})

export const embedBlockSchema = z.object({
  type: z.literal('embed'),
  heading: z.string().optional(),
  embedHtml: z.string(),
})

export const genericSectionBlockSchema = z.object({
  type: z.literal('generic_section'),
  heading: z.string().optional(),
  rawHtml: z.string(),
})

export const contentBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  textSectionBlockSchema,
  featureGridBlockSchema,
  testimonialBlockSchema,
  teamGridBlockSchema,
  ctaBlockSchema,
  contactInfoBlockSchema,
  faqBlockSchema,
  statsBlockSchema,
  imageGalleryBlockSchema,
  pricingTableBlockSchema,
  logoCloudBlockSchema,
  embedBlockSchema,
  genericSectionBlockSchema,
])

// --- Page schema ---

export const pageArchetypeSchema = z.nativeEnum(PageArchetype)

export const pageSchemaSchema = z.object({
  url: z.string(),
  title: z.string(),
  archetype: pageArchetypeSchema,
  metaDescription: z.string().optional(),
  blocks: z.array(contentBlockSchema),
})

// --- Site schema ---

export const brandColorsSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  background: z.string().optional(),
  text: z.string().optional(),
})

export const navItemSchema: z.ZodType<{
  label: string
  url: string
  children?: Array<{ label: string; url: string; children?: unknown[] }>
}> = z.object({
  label: z.string(),
  url: z.string(),
  children: z.array(z.lazy(() => navItemSchema)).optional(),
})

export const siteSchemaSchema = z.object({
  rootUrl: z.string(),
  siteName: z.string(),
  tagline: z.string().optional(),
  brandColors: brandColorsSchema,
  faviconUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  nav: z.array(navItemSchema),
  pages: z.array(pageSchemaSchema),
})
