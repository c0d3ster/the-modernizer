import type { SiteImage } from '@modernizer/schema'
import { z } from 'zod'

import { callLlmWithTool } from './llm-client.js'
import { chooseHeroPrompt, chooseHeroTool } from './prompts/choose-hero.js'

// Words in a file name or alt text that usually mean graphics, signs or flyers rather than photos
const NOT_A_HERO = /logo|sign|menu|flyer|poster|coupon|special|event|dinner|welcome|banner|graphic|badge|award|text|header|title/i
const MAX_CANDIDATES = 4

/** Banners and strips (wider than 3:1 or taller than 1:2) can't fill a hero, however large. */
const isStrip = ({ width, height }: SiteImage): boolean => Boolean(width && height && (width / height > 3 || width / height < 0.5))

/**
 * Deterministic pre-score for a photo as the home hero: early on the home page, large, landscape,
 * and not named like a graphic. Higher is better.
 */
export const heroScore = (image: SiteImage, homeUrl: string): number => {
  let score = 0
  // The home page already shows its best photos up top; another page's photos must be much better to win
  if (image.pageUrl === homeUrl) score += 5
  score += 2 * (1 - Math.min(image.order, 15) / 15)
  const longest = Math.max(image.width ?? 0, image.height ?? 0)
  if (longest >= 1200) score += 2
  else if (longest >= 700) score += 1
  else if (longest > 0 && longest < 400) score -= 3
  if (image.width && image.height) {
    const aspect = image.width / image.height
    if (isStrip(image)) score -= 6
    else if (aspect >= 1.2 && aspect <= 2.4) score += 2
    else if (aspect < 0.9) score -= 2 // portrait crops poorly into a wide hero
  }
  if (NOT_A_HERO.test(`${image.url} ${image.alt ?? ''}`)) score -= 2
  if (/\.gif(\?|$)/i.test(image.url)) score -= 2
  return score
}

/** The best few photos by pre-score, one per alt text so crops of the same shot don't crowd out others. */
export const heroCandidates = (images: readonly SiteImage[], homeUrl: string): SiteImage[] => {
  const seenAlt = new Set<string>()
  return images
    .filter((i) => i.kind === 'photo' && !isStrip(i))
    .map((image) => ({ image, score: heroScore(image, homeUrl) }))
    .filter(({ score }) => score > -3)
    .sort((a, b) => b.score - a.score)
    .filter(({ image }) => {
      if (!image.alt) return true
      const key = image.alt.toLowerCase()
      if (seenAlt.has(key)) return false
      seenAlt.add(key)
      return true
    })
    .slice(0, MAX_CANDIDATES)
    .map(({ image }) => image)
}

const choiceSchema = z.object({ choice: z.number().int().min(0).nullable() })

/**
 * Picks the home hero photo: the deterministic pre-score shortlists, then one vision call chooses the
 * shot that best shows the business without large text (a sign or flyer reads badly behind a headline).
 * Falls back to the top pre-score when the call fails or none of the shortlist fits.
 */
export const chooseHeroImage = async (images: readonly SiteImage[], homeUrl: string, siteName: string): Promise<string | undefined> => {
  const candidates = heroCandidates(images, homeUrl)
  if (candidates.length <= 1) return candidates[0]?.url
  try {
    const result = choiceSchema.parse(await callLlmWithTool<unknown>(chooseHeroPrompt(candidates, siteName), chooseHeroTool))
    if (result.choice === null) return undefined
    return candidates[result.choice]?.url ?? candidates[0]?.url
  } catch (err) {
    console.log(`  [hero] could not compare photos (${err instanceof Error ? err.message.split('\n')[0] : String(err)}), using the top-ranked one`)
    return candidates[0]?.url
  }
}
