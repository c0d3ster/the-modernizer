import { z } from 'zod'

// Values and labels of c0d3ster's ProjectFeature enum (c0d3ster src/graphql/schema/project.ts and
// src/libs/featureLabels.ts). The two repos don't share a package, so this is a copy: keep it in sync
// when the enum changes there.
export const PROJECT_FEATURE_VALUES = [
  'database',
  'auth',
  'email',
  'responsive_design',
  'custom_design',
  'payment_processing',
  'ecommerce_platform_integration',
  'cms_integration',
  'content_creation',
  'seo',
  'analytics',
  'deployment',
  'domain_config',
  'admin_dashboard',
  'custom_api',
  'file_uploads',
  'qa_launch_testing',
  'maintenance_retainer',
  'technical_advisory',
  'online_booking',
  'live_chat',
  'reviews',
] as const

export type ProjectFeatureValue = (typeof PROJECT_FEATURE_VALUES)[number]

export const PROJECT_FEATURE_LABELS: Record<ProjectFeatureValue, string> = {
  database: 'Database Design & Setup',
  auth: 'Authentication System',
  email: 'Email Integration',
  responsive_design: 'Mobile-Responsive Design',
  custom_design: 'Custom UI/UX Design & Branding',
  payment_processing: 'Payment Processing',
  ecommerce_platform_integration: 'E-Commerce Platform Integration',
  cms_integration: 'CMS Integration',
  content_creation: 'Content Writing & Population',
  seo: 'SEO Setup',
  analytics: 'Analytics Setup',
  deployment: 'Deployment & CI/CD Setup',
  domain_config: 'Domain Configuration',
  admin_dashboard: 'Admin Dashboard',
  custom_api: 'Custom API Endpoints',
  file_uploads: 'File Upload System',
  qa_launch_testing: 'QA & Launch Testing',
  maintenance_retainer: 'Ongoing Maintenance & Support',
  technical_advisory: 'Technical Advisory',
  online_booking: 'Online Booking',
  live_chat: 'Live Chat',
  reviews: 'Reviews & Testimonials',
}

export const projectFeatureValueSchema = z.enum(PROJECT_FEATURE_VALUES)

export const VIEWPORT_NAMES = ['desktop', 'mobile', 'small'] as const
export const viewportNameSchema = z.enum(VIEWPORT_NAMES)
export type ViewportName = z.infer<typeof viewportNameSchema>

export const pageCtaSchema = z.object({
  text: z.string(),
  // Plain-language destination, e.g. "starts a phone call" or "online booking (LocalMed)"
  goesTo: z.string(),
})

export const pageSeoSchema = z.object({
  title: z.boolean(),
  metaDescription: z.boolean(),
  ogTags: z.boolean(),
  localBusiness: z.boolean(),
  h1: z.number().int().nonnegative(),
  canonical: z.boolean(),
})

// One horizontal band of the header area as measured in the browser: a run of rows with the same
// background, from the top of the page down to where the hero or content starts.
export const headerBandSchema = z.object({
  top: z.number(),
  height: z.number(),
  // '#rrggbb', 'image' for a photo or gradient, or 'transparent' (over the hero)
  background: z.string(),
  links: z.number().int().nonnegative(),
  phone: z.boolean(),
  logo: z.boolean(),
  // What the band says, shortened
  text: z.string(),
})

// What the in-page detector reports for one viewport. Heuristic by nature: vendor names come from
// links, scripts and iframes, never loose page text.
export const pageFeaturesSchema = z.object({
  heroVideo: z.boolean(),
  menuLinks: z.array(z.string()),
  menuButton: z.boolean(),
  telLinks: z.number().int().nonnegative(),
  telInFold: z.boolean(),
  phoneInText: z.boolean(),
  ctas: z.array(pageCtaSchema),
  booking: z.string().nullable(),
  chat: z.string().nullable(),
  contactForm: z.boolean(),
  reviewWidget: z.string().nullable(),
  testimonials: z.boolean(),
  ordering: z.string().nullable(),
  payments: z.array(z.string()),
  payLink: z.boolean(),
  analytics: z.array(z.string()),
  portal: z.string().nullable(),
  fileUploads: z.number().int().nonnegative(),
  seo: pageSeoSchema,
  viewportMeta: z.boolean(),
  map: z.boolean(),
  social: z.array(z.string()),
  platform: z.array(z.string()),
  generator: z.string().nullable(),
  fonts: z.array(z.string()),
  copyright: z.number().int().nullable(),
  images: z.number().int().nonnegative(),
  screens: z.number().nonnegative(),
  // How far a visitor can actually scroll sideways (capped at 600)
  overflowPx: z.number().nonnegative(),
  // Measured header bands, top to bottom (absent in inspections saved before it was measured)
  headerBands: z.array(headerBandSchema).optional(),
})

export const COVERAGE_KINDS = ['cookie banner', 'popup', 'header', 'floating'] as const
export const coverageItemSchema = z.object({
  kind: z.enum(COVERAGE_KINDS),
  // Share of the first screen covered, 0-100
  pct: z.number().min(0).max(100),
  where: z.enum(['full screen', 'top', 'bottom', 'middle']),
  label: z.string(),
  top: z.number(),
  bottom: z.number(),
})

export const SCREENSHOT_POSITIONS = ['loaded', 'top', 'scrolled'] as const
export const screenshotSchema = z.object({
  // "loaded" is the page as a visitor first sees it, before cookie banners are closed
  position: z.enum(SCREENSHOT_POSITIONS),
  path: z.string(),
})

export const viewInspectionSchema = z.object({
  viewport: viewportNameSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  status: z.number().int().nullable(),
  visibleChars: z.number().int().nonnegative(),
  features: pageFeaturesSchema.nullable(),
  covered: z.array(coverageItemSchema),
  screenshots: z.array(screenshotSchema),
  error: z.string().optional(),
})

export const detectedProjectFeatureSchema = z.object({
  feature: projectFeatureValueSchema,
  label: z.string(),
  // What we saw, e.g. "ServiceTitan" or "Contact form on the home page"
  detail: z.string(),
})

export const coverageNoteSchema = z.object({
  viewport: viewportNameSchema,
  kind: z.enum(COVERAGE_KINDS),
  text: z.string(),
})

export const siteInspectionSchema = z.object({
  url: z.string(),
  finalUrl: z.string().nullable(),
  capturedAt: z.string(),
  // The site served a bot check or block page instead of its content
  blocked: z.boolean(),
  views: z.array(viewInspectionSchema),
  // Only features found on the site. Anything not listed is unknown, not missing.
  projectFeatures: z.array(detectedProjectFeatureSchema),
  smallLaptopIssues: z.array(z.string()),
  coverage: z.array(coverageNoteSchema),
})

export type PageCta = z.infer<typeof pageCtaSchema>
export type PageFeatures = z.infer<typeof pageFeaturesSchema>
export type HeaderBand = z.infer<typeof headerBandSchema>
export type CoverageItem = z.infer<typeof coverageItemSchema>
export type CoverageKind = CoverageItem['kind']
export type Screenshot = z.infer<typeof screenshotSchema>
export type ViewInspection = z.infer<typeof viewInspectionSchema>
export type DetectedProjectFeature = z.infer<typeof detectedProjectFeatureSchema>
export type CoverageNote = z.infer<typeof coverageNoteSchema>
export type SiteInspection = z.infer<typeof siteInspectionSchema>
