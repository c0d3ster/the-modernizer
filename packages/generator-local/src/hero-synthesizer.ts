import type { SiteSchema, PageSchema, HeroBlock, ImageGalleryBlock } from '@modernizer/schema'
import { PageArchetype } from '@modernizer/schema'
import type { SiteAction } from './site-style.js'

/**
 * The sample hero image shipped with the generator — copied to public/sample-hero.jpg
 * at generation time. Used as fallback background when the site has no extracted hero image.
 */
const SAMPLE_HERO_URL = '/sample-hero.jpg'

const findFirstCtaPage = (pages: PageSchema[], rootUrl: string): string | undefined =>
  pages.find((p) => {
    try {
      const path = new URL(p.url, rootUrl).pathname.replace(/\/$/, '') || '/'
      return path !== '/' && (
        p.archetype === PageArchetype.Contact ||
        p.archetype === PageArchetype.Services
      )
    } catch { return false }
  })?.url

const toRelativePath = (url: string, rootUrl: string): string => {
  try {
    const origin = new URL(rootUrl).origin
    const parsed = new URL(url, rootUrl)
    if (parsed.origin === origin) return parsed.pathname.replace(/\/$/, '') || '/'
  } catch { /* ignore */ }
  return url
}

/**
 * Ensures every non-home page starts with a visual header (solid-color hero, no image).
 * Uses the page title as the heading and metaDescription as subheading if available.
 * Skips pages that already open with a hero block.
 */
export const synthesizePageHeaders = (schema: SiteSchema): SiteSchema => {
  if (schema.generator?.noHero) return schema

  const rootUrl = schema.rootUrl
  const pages = schema.pages.map((page) => {
    const isHome = (() => {
      try {
        return (new URL(page.url, rootUrl).pathname.replace(/\/$/, '') || '/') === '/'
      } catch {
        return false
      }
    })()
    if (isHome) return page
    if (page.blocks[0]?.type === 'hero') return page

    const header: HeroBlock = {
      type: 'hero',
      heading: page.title,
      subheading: page.metaDescription,
      compact: true,
    }

    return { ...page, blocks: [header, ...page.blocks] }
  })

  return { ...schema, pages }
}

/**
 * Ensures the homepage has a hero block at the top.
 *
 * - If the homepage already starts with a hero, does nothing.
 * - If `schema.generator.noHero` is true, does nothing.
 * - Otherwise prepends a synthesized HeroBlock built from site metadata.
 *
 * The background image comes from the first extracted hero image found anywhere
 * in the site, falling back to the bundled sample-hero.jpg.
 */
export const synthesizeHero = (schema: SiteSchema, action?: SiteAction | null): SiteSchema => {
  if (schema.generator?.noHero) return schema

  const rootUrl = schema.rootUrl
  const homeIndex = schema.pages.findIndex((p) => {
    try {
      return (new URL(p.url, rootUrl).pathname.replace(/\/$/, '') || '/') === '/'
    } catch {
      return false
    }
  })

  if (homeIndex === -1) return schema
  const home = schema.pages[homeIndex]!

  // Preference order for background image:
  // 1. The photo extraction chose as the hero (compared against the site's other photos)
  // 2. An already-extracted hero block with a real image URL (from another page)
  // 3. The homepage's og:image (curated representative image the site provides), unless it is the logo
  // 4. Any page's og:image
  // 5. Sample fallback
  const notLogo = (url: string | undefined): string | undefined => (url && url !== schema.logoUrl ? url : undefined)
  const extractedBg =
    schema.heroImageUrl ??
    schema.pages
      .flatMap((p) => p.blocks)
      .find((b): b is HeroBlock => b.type === 'hero' && !!b.backgroundImageUrl)
      ?.backgroundImageUrl ??
    notLogo(home.ogImage) ??
    notLogo(schema.pages.find((p) => notLogo(p.ogImage))?.ogImage) ??
    SAMPLE_HERO_URL

  const ctaPage = findFirstCtaPage(schema.pages, rootUrl)

  const first = home.blocks[0]
  if (first?.type === 'hero') {
    // An extracted hero keeps its content but gets a photo and the site's main action when it has none
    const filled: HeroBlock = {
      ...first,
      backgroundImageUrl: first.backgroundImageUrl ?? extractedBg,
      ...(!first.ctaText && action ? { ctaText: action.text, ctaUrl: action.url } : {}),
    }
    const pages = [...schema.pages]
    pages[homeIndex] = { ...home, blocks: [filled, ...home.blocks.slice(1)] }
    return { ...schema, pages }
  }

  const hero: HeroBlock = {
    type: 'hero',
    heading: schema.siteName,
    subheading: schema.tagline,
    ctaText: action?.text ?? (ctaPage ? 'Get in touch' : undefined),
    ctaUrl: action?.url ?? (ctaPage ? toRelativePath(ctaPage, schema.rootUrl) : undefined),
    backgroundImageUrl: extractedBg,
  }

  const updatedHome: PageSchema = {
    ...home,
    blocks: [hero, ...home.blocks],
  }

  const pages = [...schema.pages]
  pages[homeIndex] = updatedHome

  return { ...schema, pages }
}

const GALLERY_MIN = 3
const GALLERY_MAX = 6

/**
 * Gives the home page a gallery of the site's own photos when it has none, so the real place, team
 * and food show up instead of a page of text. Skips the hero photo and anything already on the page,
 * and goes in before the closing call to action or contact block.
 */
export const synthesizeGallery = (schema: SiteSchema): SiteSchema => {
  const homeIndex = schema.pages.findIndex((p) => {
    try {
      return (new URL(p.url, schema.rootUrl).pathname.replace(/\/$/, '') || '/') === '/'
    } catch {
      return false
    }
  })
  const home = schema.pages[homeIndex]
  if (!home || home.blocks.some((b) => b.type === 'image_gallery')) return schema

  const used = new Set(
    home.blocks.flatMap((b) => (b.type === 'hero' && b.backgroundImageUrl ? [b.backgroundImageUrl] : []))
  )
  const photos = (schema.images ?? [])
    .filter((i) => i.kind === 'photo' && !used.has(i.url) && i.url !== schema.heroImageUrl && i.url !== schema.logoUrl)
    .filter((i) => !i.width || Math.max(i.width, i.height ?? 0) >= 400)
    .slice(0, GALLERY_MAX)
  if (photos.length < GALLERY_MIN) return schema

  const gallery: ImageGalleryBlock = {
    type: 'image_gallery',
    heading: 'A look around',
    images: photos.map((p) => ({ url: p.url, ...(p.alt && { alt: p.alt }) })),
  }
  const closing = home.blocks.findIndex((b, i) => i > 0 && (b.type === 'cta' || b.type === 'contact_info'))
  const at = closing === -1 ? home.blocks.length : closing
  const pages = [...schema.pages]
  pages[homeIndex] = { ...home, blocks: [...home.blocks.slice(0, at), gallery, ...home.blocks.slice(at)] }
  return { ...schema, pages }
}
