import type { SiteSchema, PageSchema, HeroBlock } from '@modernizer/schema'
import { PageArchetype } from '@modernizer/schema'

/**
 * The sample hero image shipped with the generator — copied to public/sample-hero.jpg
 * at generation time. Used as fallback background when the site has no extracted hero image.
 */
const SAMPLE_HERO_URL = '/sample-hero.jpg'

const findFirstCtaPage = (pages: PageSchema[]): string | undefined =>
  pages.find((p) => {
    try {
      const path = new URL(p.url).pathname.replace(/\/$/, '') || '/'
      return path !== '/' && (
        p.archetype === PageArchetype.Contact ||
        p.archetype === PageArchetype.Services
      )
    } catch { return false }
  })?.url

const toRelativePath = (url: string, rootUrl: string): string => {
  try {
    const origin = new URL(rootUrl).origin
    const parsed = new URL(url)
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

  const pages = schema.pages.map((page) => {
    const isHome = (() => { try { return (new URL(page.url).pathname.replace(/\/$/, '') || '/') === '/' } catch { return false } })()
    if (isHome) return page
    if (page.blocks[0]?.type === 'hero') return page

    const header: HeroBlock = {
      type: 'hero',
      heading: page.title,
      subheading: page.metaDescription,
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
export const synthesizeHero = (schema: SiteSchema): SiteSchema => {
  if (schema.generator?.noHero) return schema

  const homeIndex = schema.pages.findIndex((p) => {
    try { return (new URL(p.url).pathname.replace(/\/$/, '') || '/') === '/' }
    catch { return false }
  })

  if (homeIndex === -1) return schema

  const home = schema.pages[homeIndex]!
  if (home.blocks[0]?.type === 'hero') return schema

  // Use an existing extracted background image from anywhere in the site if available
  const extractedBg = schema.pages
    .flatMap((p) => p.blocks)
    .find((b): b is HeroBlock => b.type === 'hero' && !!b.backgroundImageUrl)
    ?.backgroundImageUrl

  const ctaPage = findFirstCtaPage(schema.pages)

  const hero: HeroBlock = {
    type: 'hero',
    heading: schema.siteName,
    subheading: schema.tagline,
    ctaText: ctaPage ? 'Get in touch' : undefined,
    ctaUrl: ctaPage ? toRelativePath(ctaPage, schema.rootUrl) : undefined,
    backgroundImageUrl: extractedBg ?? SAMPLE_HERO_URL,
  }

  const updatedHome: PageSchema = {
    ...home,
    blocks: [hero, ...home.blocks],
  }

  const pages = [...schema.pages]
  pages[homeIndex] = updatedHome

  return { ...schema, pages }
}
