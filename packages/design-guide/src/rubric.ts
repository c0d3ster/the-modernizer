// Visual design rules learned from hand ratings on the Site Rating Bench (Winchester VA).
// Problems to avoid come mostly from sites rated 1-3, patterns to aim for from sites rated 4-5.
// The same list feeds the visual scoring prompt and the generators, so each rule reads as a design
// principle, not as a note about one site.
//
// Scoring: a site starts at 100 and loses points for each problem rule it breaks, once per rule.
// Point values are set by hand from the rater's notes, in four rough bands:
//   critical 20-30  the site is broken or barely a site (no responsive layout, no site of its own)
//   major    10-15  the first impression fails (popup on load, no call to action, empty first screen)
//   moderate  4-8   a visible weakness (generic imagery, low contrast, tiny text)
//   minor     2-4   a design choice that could be better (boxy cards, no sticky header)
// A fixed rule takes `points` in full, or `partial` when the problem is only partly there. A counted
// rule takes `points` per unit, up to `max`.

export const RUBRIC_VERSION = 'v3'

export const RULE_AREAS = ['header', 'navigation', 'first-screen', 'overlays', 'typography', 'color', 'imagery', 'mobile', 'cta', 'consistency'] as const
export type RuleArea = (typeof RULE_AREAS)[number]

export type RuleScoring =
  | { type: 'fixed'; points: number; partial: number }
  | { type: 'per-unit'; unit: string; points: number; max: number }

export interface ProblemRule {
  kind: 'avoid'
  id: string
  area: RuleArea
  rule: string
  scoring: RuleScoring
}

export interface PatternRule {
  kind: 'aim-for'
  id: string
  area: RuleArea
  rule: string
}

export type DesignRule = ProblemRule | PatternRule

const fixed = (points: number, partial: number): RuleScoring => ({ type: 'fixed', points, partial })

export const DESIGN_RULES: readonly DesignRule[] = [
  // Overall
  {
    kind: 'avoid',
    id: 'dated-overall',
    area: 'consistency',
    scoring: fixed(15, 8),
    rule: 'The site as a whole reads as an older template (roughly 2010-2016): stock theme layout, bevels, drop shadows or busy textures, cramped spacing, weak hierarchy, dated fonts together. Partial when it is mostly current with a few dated pieces. Judge the overall impression; the specific problems below are charged separately.',
  },
  {
    kind: 'avoid',
    id: 'layout-boxed',
    area: 'consistency',
    scoring: fixed(6, 3),
    rule: 'The whole page boxed into a narrow column on a laptop, leaving wide empty bands on both sides, while full-width sections (hero, bars) would read as current.',
  },
  // Header
  {
    kind: 'avoid',
    id: 'header-bars',
    area: 'header',
    scoring: { type: 'per-unit', unit: 'costly extra header bar', points: 5, max: 15 },
    rule: 'Header bars stacked above the page (utility bar, logo bar, menu bar, promo banner). Count the costly extra bars: a second bar costs nothing when it holds links found nowhere else up front (forms, payments, referrals, social links), ideally hiding on scroll, and counts as 1 when it repeats what the main header shows (the same phone, address or button). A third bar counts 2 in total and a fourth counts 3, whatever they hold.',
  },
  {
    kind: 'avoid',
    id: 'header-oversized',
    area: 'header',
    scoring: fixed(10, 5),
    rule: 'A header or logo so tall that it eats the first screen, pushes the hero or main button below the fold, or leaves a large empty band.',
  },
  {
    kind: 'avoid',
    id: 'header-not-sticky',
    area: 'header',
    scoring: fixed(3, 2),
    rule: 'No sticky or floating header, so the menu and main button disappear once the visitor scrolls.',
  },
  {
    kind: 'avoid',
    id: 'header-alignment',
    area: 'header',
    scoring: fixed(4, 2),
    rule: 'Pieces out of line: icons or buttons not aligned with their container, a header button not vertically centered, a header boxed in narrower than the page while bars around it run full width, a logo outside the header, a logo with a solid box behind it instead of a transparent background, or items overlapping.',
  },
  {
    kind: 'aim-for',
    id: 'header-compact-sticky',
    area: 'header',
    rule: 'One compact, full-width header that floats on scroll and shrinks to a single bar once the visitor moves down the page.',
  },
  // Navigation
  {
    kind: 'avoid',
    id: 'nav-too-many',
    area: 'navigation',
    scoring: fixed(3, 2),
    rule: 'More than about six top-level menu items, or any menu that wraps to a second line at common laptop widths (1366px and up).',
  },
  {
    kind: 'avoid',
    id: 'nav-hidden-desktop',
    area: 'navigation',
    scoring: fixed(6, 3),
    rule: 'A hamburger menu on a laptop-width screen when there is room for the links.',
  },
  {
    kind: 'avoid',
    id: 'nav-broken',
    area: 'navigation',
    scoring: fixed(20, 10),
    rule: 'A menu that is broken, cut off, hard to see or hard to open, on phone or laptop. Menu links that go nowhere or back to the home page, or ordering links that do not work.',
  },
  {
    kind: 'avoid',
    id: 'nav-duplicates',
    area: 'navigation',
    scoring: fixed(3, 2),
    rule: 'The same item offered several times (one booking button repeated three times in the header, a dropdown that repeats its own heading), which crowds the menu.',
  },
  {
    kind: 'aim-for',
    id: 'nav-single-page',
    area: 'navigation',
    rule: 'For small sites (a restaurant, a one-truck trade), one page with anchor links that highlight the current section, instead of thin separate pages.',
  },
  // First screen
  {
    kind: 'avoid',
    id: 'first-screen-empty',
    area: 'first-screen',
    scoring: fixed(15, 8),
    rule: 'A first screen that does not say who the business is and what it offers: a bare image or menu with no intro, or content that jumps straight into details (a full food menu, a single combo deal) with no welcome.',
  },
  {
    kind: 'avoid',
    id: 'first-screen-cut-section',
    area: 'first-screen',
    scoring: fixed(4, 2),
    rule: 'The next section sliced off at the bottom of the first screen so its title is half visible. The hero should fill the screen, or the next section should show at least its whole title.',
  },
  {
    kind: 'avoid',
    id: 'first-screen-hero-text-offscreen',
    area: 'first-screen',
    scoring: fixed(4, 2),
    rule: 'Hero headline or text placed below the visible area of the hero, so the visitor sees only an image or video at first.',
  },
  {
    kind: 'avoid',
    id: 'first-screen-dead-space',
    area: 'first-screen',
    scoring: fixed(5, 3),
    rule: 'Large blank bands: empty space above or below the hero, a random empty box, or a big gap between the hero and the next section.',
  },
  {
    kind: 'avoid',
    id: 'duplicate-info',
    area: 'first-screen',
    scoring: fixed(4, 2),
    rule: 'The same information repeated within the first screen or two (the phone number in three places, the hero repeating the header), which reads as clutter.',
  },
  // Overlays
  {
    kind: 'avoid',
    id: 'overlay-popup-on-load',
    area: 'overlays',
    scoring: fixed(15, 8),
    rule: 'A popup, modal or banner that covers the page on arrival, especially one that returns on every page, duplicates a form already on the page, or stacks on top of another banner. Partial when it covers only a small part of the screen.',
  },
  {
    kind: 'avoid',
    id: 'overlay-cookie-heavy',
    area: 'overlays',
    scoring: fixed(8, 4),
    rule: 'A cookie or consent banner that covers a large share of the screen: full when it covers half or more of a phone screen, partial from about a third.',
  },
  {
    kind: 'avoid',
    id: 'overlay-floating-pileup',
    area: 'overlays',
    scoring: fixed(6, 3),
    rule: 'Several floating widgets at once (chat, reviews badge, financing, accessibility, booking), especially when they overlap each other or cover text.',
  },
  // Typography
  {
    kind: 'avoid',
    id: 'type-tiny-body',
    area: 'typography',
    scoring: fixed(6, 3),
    rule: 'Long descriptions in very small text.',
  },
  {
    kind: 'avoid',
    id: 'type-oversized',
    area: 'typography',
    scoring: fixed(3, 2),
    rule: 'Headings so large they become hard to read or break awkwardly.',
  },
  {
    kind: 'avoid',
    id: 'type-poor-choice',
    area: 'typography',
    scoring: fixed(6, 3),
    rule: 'Dated or mismatched fonts (typewriter or novelty faces for body text), cramped letter spacing on titles, cluttered blocks of text, or text aligned oddly for the screen (right-aligned subtext on a phone).',
  },
  {
    kind: 'avoid',
    id: 'type-language',
    area: 'typography',
    scoring: fixed(6, 3),
    rule: 'Awkward or machine-translated English, typos and placeholder text.',
  },
  {
    kind: 'aim-for',
    id: 'type-readable',
    area: 'typography',
    rule: 'Generous, readable body text and a clear size step between headings and body.',
  },
  // Color, contrast and shape
  {
    kind: 'avoid',
    id: 'contrast-low',
    area: 'color',
    scoring: fixed(6, 3),
    rule: 'Low contrast: button text that blends into the button, text set straight over a busy photo (or over a photo that itself contains text) with no scrim, fade or box behind it.',
  },
  {
    kind: 'avoid',
    id: 'color-incoherent',
    area: 'color',
    scoring: fixed(5, 3),
    rule: 'Colors that do not work together (a loud accent banner against an unrelated photo treatment), a harsh high-contrast gradient, or a busy textured background behind content.',
  },
  {
    kind: 'avoid',
    id: 'shape-boxy',
    area: 'color',
    scoring: fixed(2, 1),
    rule: 'Hard square boxes and borders around text blocks and cards where rounded corners and softer containers would look current.',
  },
  {
    kind: 'aim-for',
    id: 'color-cohesive',
    area: 'color',
    rule: 'A small, cohesive palette applied consistently. Soft gradients and fades that blend the hero into the page read as current and polished.',
  },
  // Imagery and motion
  {
    kind: 'avoid',
    id: 'image-generic',
    area: 'imagery',
    scoring: fixed(5, 3),
    rule: 'Imagery that does not show the business: generic stock, a photo of the sign, cheesy staged photos or clip-art.',
  },
  {
    kind: 'avoid',
    id: 'image-cropped',
    area: 'imagery',
    scoring: fixed(4, 2),
    rule: 'Hero images cropped so the subject is cut off (on phones, check that faces and the main subject stay in frame), a hero image dropped entirely on phones, or a short, letterboxed hero video that leaves the screen half empty.',
  },
  {
    kind: 'avoid',
    id: 'motion-janky',
    area: 'imagery',
    scoring: fixed(6, 3),
    rule: 'Slow, glitchy or laggy animation and video, text that appears seconds late, slow-loading images, or ugly hover captions.',
  },
  {
    kind: 'aim-for',
    id: 'image-real-place',
    area: 'imagery',
    rule: 'Real photos or video of the place, the team and the work (an aerial video of the office, the actual dining room), treated with consistent color.',
  },
  {
    kind: 'aim-for',
    id: 'cards-with-photos',
    area: 'imagery',
    rule: 'Linked cards for the main sections or services, each with a faded photo backdrop, so the page reads at a glance and every card leads somewhere.',
  },
  // Mobile
  {
    kind: 'avoid',
    id: 'mobile-not-responsive',
    area: 'mobile',
    scoring: fixed(30, 15),
    rule: 'No responsive design: on a phone the page is a shrunken desktop layout, or text and images run off the screen. Partial when only some sections break.',
  },
  {
    kind: 'avoid',
    id: 'mobile-sideways-scroll',
    area: 'mobile',
    scoring: fixed(15, 8),
    rule: 'The page scrolls sideways on a phone. Partial when it moves only slightly (under about 50px).',
  },
  {
    kind: 'avoid',
    id: 'mobile-header-eats-screen',
    area: 'mobile',
    scoring: fixed(6, 3),
    rule: 'On a phone, header bars and blank space that use most of the first screen. Combine the phone button and menu button on one line, and do not stack secondary links (like Pay Bill) so they look like the main action.',
  },
  {
    kind: 'avoid',
    id: 'mobile-little-info',
    area: 'mobile',
    scoring: fixed(5, 3),
    rule: 'A phone first screen with almost no information, often from a split desktop layout stacked badly. A menu button in place of the links is normal and does not count.',
  },
  {
    kind: 'avoid',
    id: 'mobile-type-scale',
    area: 'mobile',
    scoring: fixed(3, 2),
    rule: 'Type and spacing that do not change for phones: desktop-sized headings that crowd the screen, or the same layout simply squeezed.',
  },
  // Calls to action
  {
    kind: 'avoid',
    id: 'cta-missing',
    area: 'cta',
    scoring: fixed(15, 8),
    rule: 'No clear main action (call, book, order, get a quote) anywhere in the first screen, or one hidden behind a large logo or header. A visible phone link or booking button in the header counts as an action.',
  },
  {
    kind: 'avoid',
    id: 'cta-phone-not-tappable',
    area: 'cta',
    scoring: fixed(3, 2),
    rule: 'A phone number that is shown but too small or only plain text instead of a tap-to-call link. Check what the main button does: a "Book" button that only dials the number shown above it is a missed chance for online booking.',
  },
  {
    kind: 'avoid',
    id: 'cta-misleading',
    area: 'cta',
    scoring: fixed(3, 2),
    rule: 'A button whose label does not match what happens (a "Play welcome video" button while a video already plays), or a main action placed only in a secondary top bar.',
  },
  {
    kind: 'aim-for',
    id: 'cta-highlight-selling-points',
    area: 'cta',
    rule: 'One clear main action in the first screen, with the phone number beside the menu or in a call-to-action box, and real selling points (24-hour service, emergency visits) made prominent.',
  },
  // Consistency
  {
    kind: 'avoid',
    id: 'consistency-pages',
    area: 'consistency',
    scoring: fixed(4, 2),
    rule: 'Pages that do not match: the header changing size between pages, inner pages without a hero where the logo overlaps content.',
  },
  {
    kind: 'avoid',
    id: 'content-stale',
    area: 'consistency',
    scoring: fixed(3, 2),
    rule: 'Stale content up front: a promoted event that has already passed, old announcements, an out-of-date copyright year next to otherwise current design.',
  },
  {
    kind: 'avoid',
    id: 'not-own-site',
    area: 'consistency',
    scoring: fixed(30, 15),
    rule: 'The business has no site of its own: its "website" is a page or subsection inside another business, directory or platform site, with the generic fonts, menu and branding of that site. A strong reason to pitch.',
  },
  {
    kind: 'avoid',
    id: 'platform-leftovers',
    area: 'consistency',
    scoring: fixed(20, 10),
    rule: 'Builder leftovers: a site-builder banner or free-plan branding, default theme text, broken widgets.',
  },
]

export const PROBLEM_RULES: readonly ProblemRule[] = DESIGN_RULES.filter((r): r is ProblemRule => r.kind === 'avoid')
export const PATTERN_RULES: readonly PatternRule[] = DESIGN_RULES.filter((r): r is PatternRule => r.kind === 'aim-for')

/** The 1-5 scale shown to raters on the bench. */
export const SCORE_LEVELS: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'Ancient: looks 2012 or older. Clip-art, tiny text, boxed or table layout, feels broken on a phone.',
  2: 'Dated: mid-2010s template. Cluttered, weak hierarchy, cheesy stock or busy backgrounds.',
  3: 'Passable: generic modern template. Nothing wrong, nothing memorable.',
  4: 'Modern: clean and current. Good type, spacing and imagery.',
  5: 'Polished: custom, high craft. Agency-level work.',
}

// How the rater actually used the scale, beyond the level descriptions above.
export const CALIBRATION_NOTES: readonly string[] = [
  'Decide from the overall impression first: does the site look clean, cohesive and current, with real imagery and a clear action? Then use findings to explain the rating. Major problems move the rating; minor ones explain it but do not pull a site down a level by themselves, however many there are.',
  'The designer gives 5s readily, to about one site in six. "Agency-level" means a visitor would see nothing worth fixing, not perfection or a custom build. Do not withhold a 5 because of minor findings.',
  'A 5 has nothing worth fixing: cohesive color, real imagery, readable type, a clear call to action and a header that stays out of the way. It can be simple.',
  'A 4 is clean and current with one or two specific, fixable problems (a cut-off second section, low-contrast buttons, a crowded spot on mobile). A site that is cheesy but has every piece of information in the right place still earns a 4.',
  'A 3 has several structural problems, usually in the header and first screen (three header bars, a popup on load, a hidden call to action, dead space), even if parts look modern.',
  'A 2 is dated and also broken somewhere: menus that do not work, no responsive layout, clutter everywhere, poor fonts and imagery together.',
  'A 1 barely counts as a designed site: builder leftovers, no hero, no call to action, plain text.',
  'A major problem usually holds a site at 3 or below. A site that is clearly polished everywhere else (strong hero, cohesive color, good imagery) can still earn a 4 with one major problem, but not a 5. Two or more major problems usually mean 2.',
  'A 5 can have a couple of small polish items (an icon slightly out of line on a phone, a logo that could be smaller). Those do not pull a polished site down.',
  'Judge what a visitor experiences, not the tech underneath. Features like online booking or chat do not raise the design score by themselves.',
]

/** Whether a business is worth pitching a redesign, as the rater used it. */
export const PITCH_GUIDE: Readonly<Record<'yes' | 'maybe' | 'no', string>> = {
  yes: 'Rated 3 or below, or a 4 with a visible problem a redesign clearly fixes (an overlay in the way, no sticky header, broken alignment, no site of its own).',
  maybe: 'Usually a 4, sometimes a 5 with small polish items: good already, but there are specific fixes or features worth offering.',
  no: 'Usually a 5, or a 4 with nothing meaningful to fix: a pitch would not land.',
}
