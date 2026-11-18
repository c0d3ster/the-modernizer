import { PROJECT_FEATURE_LABELS } from '@modernizer/schema'
import type { DetectedProjectFeature, PageFeatures, ProjectFeatureValue } from '@modernizer/schema'

const CMS_PLATFORMS = new Set(['WordPress', 'Wix', 'Squarespace', 'GoDaddy Website Builder', 'Weebly', 'Duda', 'Webflow', 'Shopify', 'ProSites', 'Officite', 'Sesame', 'PBHS'])
const STORE_PLATFORMS = new Set(['Shopify', 'WooCommerce', 'Ecwid'])
const FINANCING = new Set(['CareCredit', 'Cherry', 'Sunbit'])
const GENERIC_CHAT = new Set(['chat button', 'chat widget'])
// The mobile pass may fall over a horizontal scroll this small from a stray element; it isn't a real layout break.
const MOBILE_OVERFLOW_TOLERANCE_PX = 20

const unique = (values: string[]): string[] => [...new Set(values.filter((v) => v.length > 0))]
const firstOf = (values: (string | null | undefined)[]): string | null => values.find((v): v is string => Boolean(v)) ?? null

export interface ProjectFeatureInput {
  laptop: PageFeatures | null
  mobile: PageFeatures | null
  small: PageFeatures | null
}

/**
 * Maps on-page detections to c0d3ster ProjectFeature values. Only features we can see from outside
 * are reported, and only when found: anything not listed is unknown, never "missing", so a pitch
 * doesn't offer something the business already has.
 *
 * Vendor checks (booking, ordering, payments, portal, analytics) use the laptop pass. Chat and
 * reviews can also appear only on mobile or the small-laptop view, so those check every view.
 */
export const detectProjectFeatures = ({ laptop, mobile, small }: ProjectFeatureInput): DetectedProjectFeature[] => {
  if (!laptop) return []
  const views = [laptop, mobile, small].filter((f): f is PageFeatures => f !== null)
  const found: DetectedProjectFeature[] = []
  const add = (feature: ProjectFeatureValue, detail: string): void => {
    found.push({ feature, label: PROJECT_FEATURE_LABELS[feature], detail })
  }

  if (mobile && mobile.viewportMeta && mobile.overflowPx <= MOBILE_OVERFLOW_TOLERANCE_PX) add('responsive_design', 'Fits phone screens')

  const { seo } = laptop
  if (seo.title && seo.metaDescription && (seo.ogTags || seo.localBusiness)) {
    const parts = ['Title', 'description', ...(seo.ogTags ? ['social preview tags'] : []), ...(seo.localBusiness ? ['business schema'] : [])]
    add('seo', parts.join(', '))
  }

  if (laptop.analytics.length) add('analytics', unique(laptop.analytics).join(', '))

  const cms = laptop.platform.filter((p) => CMS_PLATFORMS.has(p))
  if (cms.length) add('cms_integration', cms.join(', '))

  if (laptop.payments.length) {
    add('payment_processing', laptop.payments.map((p) => (FINANCING.has(p) ? `${p} financing` : p)).join(', '))
  } else if (laptop.payLink) {
    add('payment_processing', 'Pay online link')
  }

  if (laptop.ordering) {
    add('ecommerce_platform_integration', STORE_PLATFORMS.has(laptop.ordering) ? `${laptop.ordering} store` : `Online ordering (${laptop.ordering})`)
  }

  if (laptop.portal) add('auth', `"${laptop.portal}" link`)
  if (views.some((f) => f.fileUploads > 0)) add('file_uploads', 'File upload field on the home page')
  if (views.some((f) => f.contactForm)) add('email', 'Contact form on the home page')

  const bookingFromButton = laptop.ctas
    .map((c) => /^online booking \((.+)\)$/.exec(c.goesTo)?.[1])
    .find((v): v is string => Boolean(v))
  const booking = laptop.booking ?? bookingFromButton
  if (booking) add('online_booking', booking)

  const chat = firstOf(views.map((f) => f.chat))
  if (chat) add('live_chat', GENERIC_CHAT.has(chat) ? 'Chat button on the site' : chat)

  const widget = firstOf(views.map((f) => f.reviewWidget))
  if (widget) add('reviews', `${widget} widget`)
  else if (views.some((f) => f.testimonials)) add('reviews', 'Reviews or testimonials shown')

  return found
}
