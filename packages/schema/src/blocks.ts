export interface HeroBlock {
  type: 'hero'
  heading: string
  subheading?: string
  ctaText?: string
  ctaUrl?: string
  backgroundImageUrl?: string
}

export interface TextSectionBlock {
  type: 'text_section'
  heading?: string
  body: string
}

export interface FeatureGridBlock {
  type: 'feature_grid'
  heading?: string
  features: Array<{
    title: string
    description: string
    iconUrl?: string
  }>
}

export interface TestimonialBlock {
  type: 'testimonial'
  heading?: string
  testimonials: Array<{
    quote: string
    author: string
    role?: string
    avatarUrl?: string
  }>
}

export interface TeamGridBlock {
  type: 'team_grid'
  heading?: string
  members: Array<{
    name: string
    role?: string
    bio?: string
    photoUrl?: string
  }>
}

export interface CTABlock {
  type: 'cta'
  heading: string
  subheading?: string
  ctaText: string
  ctaUrl: string
}

export interface ContactInfoBlock {
  type: 'contact_info'
  heading?: string
  phone?: string
  email?: string
  address?: string
  mapEmbedUrl?: string
}

export interface FAQBlock {
  type: 'faq'
  heading?: string
  items: Array<{
    question: string
    answer: string
  }>
}

export interface StatsBlock {
  type: 'stats'
  heading?: string
  stats: Array<{
    value: string
    label: string
  }>
}

export interface ImageGalleryBlock {
  type: 'image_gallery'
  heading?: string
  images: Array<{
    url: string
    alt?: string
    caption?: string
  }>
}

export interface PricingTableBlock {
  type: 'pricing_table'
  heading?: string
  tiers: Array<{
    name: string
    price: string
    description?: string
    features: string[]
    ctaText?: string
    ctaUrl?: string
  }>
}

export interface LogoCloudBlock {
  type: 'logo_cloud'
  heading?: string
  logos: Array<{
    name: string
    imageUrl: string
    url?: string
  }>
}

export interface EmbedBlock {
  type: 'embed'
  heading?: string
  embedHtml: string
}

export interface GenericSectionBlock {
  type: 'generic_section'
  heading?: string
  rawHtml: string
}

export type ContentBlock =
  | HeroBlock
  | TextSectionBlock
  | FeatureGridBlock
  | TestimonialBlock
  | TeamGridBlock
  | CTABlock
  | ContactInfoBlock
  | FAQBlock
  | StatsBlock
  | ImageGalleryBlock
  | PricingTableBlock
  | LogoCloudBlock
  | EmbedBlock
  | GenericSectionBlock
