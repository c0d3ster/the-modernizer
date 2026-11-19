import type { ContentBlock, HeroBlock } from '@modernizer/schema'

// Page builders often leave the home page with leftovers around the hero: a stray block that
// repeats the hero's own text, or two hero bands in a row (an SEO title band, then the real one).
// These rules make the hero the first block and give it the chosen photo.

const words = (text: string): string[] =>
  text
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 1)

/** A block before the hero whose words all appear in the hero (a duplicate title band). */
const repeatsHero = (block: ContentBlock, hero: HeroBlock): boolean => {
  if (block.type !== 'generic_section' && block.type !== 'text_section') return false
  const heroWords = new Set(words(`${hero.heading} ${hero.subheading ?? ''}`))
  const own = words(block.type === 'generic_section' ? block.rawHtml : `${block.heading ?? ''} ${block.body}`)
  return own.length > 0 && own.every((w) => heroWords.has(w))
}

/** Two heroes in a row: keep the one with more to say, and whichever photo they have. */
const mergeHeroes = (a: HeroBlock, b: HeroBlock): HeroBlock => {
  const score = (h: HeroBlock): number => (h.subheading ? 2 : 0) + (h.ctaText ? 2 : 0) + (h.heading.length <= 90 ? 1 : 0)
  const [main, other] = score(b) > score(a) ? [b, a] : [a, b]
  const backgroundImageUrl = main.backgroundImageUrl ?? other.backgroundImageUrl
  return { ...main, ...(backgroundImageUrl && { backgroundImageUrl }) }
}

export const tidyHomeBlocks = (blocks: readonly ContentBlock[], heroImageUrl?: string): ContentBlock[] => {
  const heroAt = blocks.findIndex((b) => b.type === 'hero')
  if (heroAt === -1 || heroAt > 2) return [...blocks]
  const firstHero = blocks[heroAt]
  if (firstHero?.type !== 'hero') return [...blocks]

  // Drop leftovers ahead of the hero that only repeat it; anything else moves just below the hero
  const before = blocks.slice(0, heroAt).filter((b) => !repeatsHero(b, firstHero))
  let hero = firstHero
  let rest = blocks.slice(heroAt + 1)
  const next = rest[0]
  if (next?.type === 'hero') {
    hero = mergeHeroes(hero, next)
    rest = rest.slice(1)
  }
  if (heroImageUrl) hero = { ...hero, backgroundImageUrl: heroImageUrl }
  return [hero, ...before, ...rest]
}
