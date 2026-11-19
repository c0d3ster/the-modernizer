// Visual design rules learned from hand ratings on the Site Rating Bench (Winchester VA, rubric v1).
// "avoid" rules come mostly from sites rated 1-3, "aim for" rules from sites rated 4-5. The same
// list feeds the visual scoring prompt and is meant to guide the local generator, so a rule should
// read as a design principle, not as a note about one site.

export const RUBRIC_VERSION = 'v1'

export const RULE_AREAS = ['header', 'navigation', 'first-screen', 'overlays', 'typography', 'imagery', 'mobile', 'consistency', 'cta', 'color'] as const
export type RuleArea = (typeof RULE_AREAS)[number]

export interface DesignRule {
  id: string
  area: RuleArea
  kind: 'avoid' | 'aim-for'
  // How hard a breach pulls the score down. "major" alone keeps a site at 3 or below.
  weight: 'major' | 'minor'
  rule: string
}

export const DESIGN_RULES: readonly DesignRule[] = [
  // Header
  {
    id: 'header-stack',
    area: 'header',
    kind: 'avoid',
    weight: 'major',
    rule: 'More than two stacked header bars (utility bar, logo bar, menu bar, promo banner). Three or more always costs points, on mobile even more so.',
  },
  {
    id: 'header-duplicate-bar',
    area: 'header',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A second header bar that repeats what the main header already shows (the same phone number, address or button). A top bar is fine when it holds things found nowhere else up front (patient forms, payments, referrals, social links), and best when it hides on scroll.',
  },
  {
    id: 'header-oversized',
    area: 'header',
    kind: 'avoid',
    weight: 'major',
    rule: 'A header or logo so tall that it eats the first screen, pushes the hero or main button below the fold, or leaves a large empty band.',
  },
  {
    id: 'header-not-sticky',
    area: 'header',
    kind: 'avoid',
    weight: 'minor',
    rule: 'No sticky or floating header, so the menu and main button disappear once the visitor scrolls.',
  },
  {
    id: 'header-alignment',
    area: 'header',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Pieces out of line: icons or buttons not aligned with their container, a header button not vertically centered, a header boxed in narrower than the page while bars around it run full width, a logo outside the header, a logo with a solid box behind it instead of a transparent background, or items overlapping.',
  },
  {
    id: 'header-compact-sticky',
    area: 'header',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'One compact, full-width header that floats on scroll and shrinks to a single bar once the visitor moves down the page.',
  },
  // Navigation
  {
    id: 'nav-too-many',
    area: 'navigation',
    kind: 'avoid',
    weight: 'minor',
    rule: 'More than about six top-level menu items, or any menu that wraps to a second line at common laptop widths (1366px and up).',
  },
  {
    id: 'nav-hidden-desktop',
    area: 'navigation',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A hamburger menu on a laptop-width screen when there is room for the links.',
  },
  {
    id: 'nav-broken',
    area: 'navigation',
    kind: 'avoid',
    weight: 'major',
    rule: 'A menu that is broken, cut off, hard to see or hard to open, on phone or laptop. Menu links that go nowhere or back to the home page, or ordering links that do not work.',
  },
  {
    id: 'nav-duplicates',
    area: 'navigation',
    kind: 'avoid',
    weight: 'minor',
    rule: 'The same item offered several times (one booking button repeated three times in the header, a dropdown that repeats its own heading), which crowds the menu.',
  },
  {
    id: 'nav-single-page',
    area: 'navigation',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'For small sites (a restaurant, a one-truck trade), one page with anchor links that highlight the current section, instead of thin separate pages.',
  },
  // First screen
  {
    id: 'first-screen-empty',
    area: 'first-screen',
    kind: 'avoid',
    weight: 'major',
    rule: 'A first screen that does not say who the business is and what it offers: a bare image or menu with no intro, or content that jumps straight into details (a full food menu, a single combo deal) with no welcome.',
  },
  {
    id: 'first-screen-cut-section',
    area: 'first-screen',
    kind: 'avoid',
    weight: 'minor',
    rule: 'The next section sliced off at the bottom of the first screen so its title is half visible. The hero should fill the screen, or the next section should show at least its whole title.',
  },
  {
    id: 'first-screen-hero-text-offscreen',
    area: 'first-screen',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Hero headline or text placed below the visible area of the hero, so the visitor sees only an image or video at first.',
  },
  {
    id: 'first-screen-dead-space',
    area: 'first-screen',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Large blank bands: empty space above or below the hero, a random empty box, or a big gap between the hero and the next section.',
  },
  {
    id: 'duplicate-info',
    area: 'first-screen',
    kind: 'avoid',
    weight: 'minor',
    rule: 'The same information repeated within the first screen or two (the phone number in three places, the hero repeating the header), which reads as clutter.',
  },
  // Overlays
  {
    id: 'overlay-popup-on-load',
    area: 'overlays',
    kind: 'avoid',
    weight: 'major',
    rule: 'A popup, modal or banner that covers the page on arrival, especially one that returns on every page, duplicates a form already on the page, or stacks on top of another banner.',
  },
  {
    id: 'overlay-cookie-heavy',
    area: 'overlays',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A cookie or consent banner that covers a large share of the screen (a third or more on a phone).',
  },
  {
    id: 'overlay-floating-pileup',
    area: 'overlays',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Several floating widgets at once (chat, reviews badge, financing, accessibility, booking), especially when they overlap each other or cover text.',
  },
  // Typography
  {
    id: 'type-tiny-body',
    area: 'typography',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Long descriptions in very small text.',
  },
  {
    id: 'type-oversized',
    area: 'typography',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Headings so large they become hard to read or break awkwardly.',
  },
  {
    id: 'type-poor-choice',
    area: 'typography',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Dated or mismatched fonts (typewriter or novelty faces for body text), cramped letter spacing on titles, cluttered blocks of text, or text aligned oddly for the screen (right-aligned subtext on a phone).',
  },
  {
    id: 'type-language',
    area: 'typography',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Awkward or machine-translated English, typos and placeholder text.',
  },
  {
    id: 'type-readable',
    area: 'typography',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'Generous, readable body text and a clear size step between headings and body.',
  },
  // Color and contrast
  {
    id: 'contrast-low',
    area: 'color',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Low contrast: button text that blends into the button, text set straight over a busy photo (or over a photo that itself contains text) with no scrim, fade or box behind it.',
  },
  {
    id: 'color-incoherent',
    area: 'color',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Colors that do not work together (a loud accent banner against an unrelated photo treatment), or a busy textured background behind content.',
  },
  {
    id: 'color-cohesive',
    area: 'color',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'A small, cohesive palette applied consistently. Soft gradients and fades that blend the hero into the page read as current and polished; a harsh, high-contrast gradient does not.',
  },
  {
    id: 'shape-boxy',
    area: 'color',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Hard square boxes and borders around text blocks and cards where rounded corners and softer containers would look current.',
  },
  {
    id: 'cards-with-photos',
    area: 'imagery',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'Linked cards for the main sections or services, each with a faded photo backdrop, so the page reads at a glance and every card leads somewhere.',
  },
  // Imagery and motion
  {
    id: 'image-generic',
    area: 'imagery',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Imagery that does not show the business: generic stock, a photo of the sign, cheesy staged photos or clip-art.',
  },
  {
    id: 'image-cropped',
    area: 'imagery',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Hero images cropped so the subject is cut off (on phones, check that faces and the main subject stay in frame), a hero image dropped entirely on phones, or a short, letterboxed hero video that leaves the screen half empty.',
  },
  {
    id: 'motion-janky',
    area: 'imagery',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Slow, glitchy or laggy animation and video, text that appears seconds late, slow-loading images, or ugly hover captions.',
  },
  {
    id: 'image-real-place',
    area: 'imagery',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'Real photos or video of the place, the team and the work (an aerial video of the office, the actual dining room), treated with consistent color.',
  },
  // Mobile
  {
    id: 'mobile-sideways-scroll',
    area: 'mobile',
    kind: 'avoid',
    weight: 'major',
    rule: 'Any sideways scroll on a phone, or a page that is not responsive at all (a shrunken desktop layout).',
  },
  {
    id: 'mobile-header-eats-screen',
    area: 'mobile',
    kind: 'avoid',
    weight: 'minor',
    rule: 'On a phone, header bars and blank space that use most of the first screen. Combine the phone button and menu button on one line, and do not stack secondary links (like Pay Bill) so they look like the main action.',
  },
  {
    id: 'mobile-little-info',
    area: 'mobile',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A phone first screen with almost no information, often from a split desktop layout stacked badly.',
  },
  {
    id: 'mobile-type-scale',
    area: 'mobile',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Type and spacing that do not change for phones: desktop-sized headings that crowd the screen, or the same layout simply squeezed.',
  },
  // Calls to action
  {
    id: 'cta-missing',
    area: 'cta',
    kind: 'avoid',
    weight: 'major',
    rule: 'No clear main action in the first screen, or one hidden behind a large logo or header.',
  },
  {
    id: 'cta-phone-not-tappable',
    area: 'cta',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A phone number that is shown but too small or only plain text instead of a tap-to-call link. Check what the main button does: a "Book" button that only dials the number shown above it is a missed chance for online booking.',
  },
  {
    id: 'cta-highlight-selling-points',
    area: 'cta',
    kind: 'aim-for',
    weight: 'minor',
    rule: 'One clear main action in the first screen, with the phone number beside the menu or in a call-to-action box, and real selling points (24-hour service, emergency visits) made prominent.',
  },
  {
    id: 'cta-misleading',
    area: 'cta',
    kind: 'avoid',
    weight: 'minor',
    rule: 'A button whose label does not match what happens (a "Play welcome video" button while a video already plays), or a main action placed only in a secondary top bar.',
  },
  // Consistency
  {
    id: 'consistency-pages',
    area: 'consistency',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Pages that do not match: the header changing size between pages, inner pages without a hero where the logo overlaps content.',
  },
  {
    id: 'content-stale',
    area: 'consistency',
    kind: 'avoid',
    weight: 'minor',
    rule: 'Stale content up front: a promoted event that has already passed, old announcements, an out-of-date copyright year next to otherwise current design.',
  },
  {
    id: 'not-own-site',
    area: 'consistency',
    kind: 'avoid',
    weight: 'major',
    rule: 'The business has no site of its own: its "website" is a page or subsection inside another business, directory or platform site, with the generic fonts, menu and branding of that site. This is a big deduction and a strong reason to pitch.',
  },
  {
    id: 'platform-leftovers',
    area: 'consistency',
    kind: 'avoid',
    weight: 'major',
    rule: 'Builder leftovers: a site-builder banner or free-plan branding, default theme text, broken widgets.',
  },
]

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
