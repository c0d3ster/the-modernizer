import type { SiteSchema, VerticalId } from '@modernizer/schema'

// Keyword patterns per vertical. Deterministic on purpose: the business name, menu, page titles and
// page text say what a local business does in almost every case.
const PATTERNS: readonly (readonly [Exclude<VerticalId, 'general'>, RegExp])[] = [
  ['dental', /\b(dent(al|ist|istry|ures?)|orthodont\w*|endodont\w*|periodont\w*|oral (and|&) (maxillo)?facial|oral surgery|braces|invisalign|implants?|dds|dmd|hygien\w*|smiles?|teeth|tooth|crowns?|root canals?)\b/gi],
  ['home-services', /\b(plumb\w*|hvac|heating|cooling|air condition\w*|heat pumps?|air quality|furnaces?|water heaters?|drains?|sewer|rooter|handyman|electric(al|ian)|roofing|gutters?|remodel\w*|contractors?|septic|duct\w*|comfort|generators?|residential|emergency service)\b/gi],
  ['cafe', /\b(caf[eé]|coffee|espresso|latte|roast(ed|ery|ers?)|bakery|pastr(y|ies)|bagels?|donuts?)\b/gi],
  ['restaurant', /\b(restaurants?|bistro|grill|kitchen|trattoria|cucina|pizzeria|pizza|sushi|tapas|tavern|brew(ery|pub)|beer|taproom|wine|cocktails?|bar|lounge|bites|sips|steakhouse|diner|deli|eatery|dinner|lunch|brunch|entrees?|appetizers?|menu|reservations?|dine in|takeout|catering|chicken|wings|burgers?|fusion|happy hour|food)\b/gi],
]

// Places API business types used by discovery, mapped onto profiles
const BUSINESS_TYPES: readonly (readonly [RegExp, VerticalId])[] = [
  [/dentist|dental|orthodont|endodont|periodont|oral surgeon/i, 'dental'],
  [/plumb|hvac|heating|air condition|electric|handyman|roof|contractor/i, 'home-services'],
  [/cafe|coffee|bakery/i, 'cafe'],
  [/restaurant|\bbar\b|grill|pizza|food/i, 'restaurant'],
]

/** Maps a discovery business type (the Places query, e.g. "hvac contractor") to a profile. */
export const verticalFromBusinessType = (businessType: string): VerticalId =>
  BUSINESS_TYPES.find(([pattern]) => pattern.test(businessType))?.[1] ?? 'general'

// Page text beyond this adds little and lets one long page outvote the business name
const MAX_TEXT_CHARS = 20_000

const textOf = (schema: Pick<SiteSchema, 'siteName' | 'tagline' | 'nav' | 'pages'>): { strong: string; weak: string } => {
  const navLabels = schema.nav.flatMap((n) => [n.label, ...(n.children ?? []).map((c) => c.label)])
  const titles = schema.pages.map((p) => p.title)
  const blockText = schema.pages.flatMap((p) => p.blocks.flatMap((b) => Object.values(b).filter((v): v is string => typeof v === 'string' && v.length < 2000)))
  return { strong: [schema.siteName, schema.tagline ?? ''].join(' '), weak: [...navLabels, ...titles, ...blockText].join(' ').slice(0, MAX_TEXT_CHARS) }
}

/**
 * Picks the design profile for a site from its name, tagline, menu, page titles and page text. The
 * name and tagline count three times as much as the rest. Returns "general" when nothing matches.
 */
export const detectVertical = (schema: Pick<SiteSchema, 'siteName' | 'tagline' | 'nav' | 'pages'>): VerticalId => {
  const { strong, weak } = textOf(schema)
  const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0
  const scored = PATTERNS.map(([vertical, pattern]) => ({ vertical, score: count(strong, pattern) * 3 + count(weak, pattern) }))
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  return best.score >= 2 ? best.vertical : 'general'
}

/** The site's vertical: the one set on the schema, or the detected one. */
export const verticalOf = (schema: Pick<SiteSchema, 'siteName' | 'tagline' | 'nav' | 'pages' | 'vertical'>): VerticalId => schema.vertical ?? detectVertical(schema)
