import type { VerticalId } from '@modernizer/schema'

// Design profiles per business type, learned from the 60 Winchester sites rated on the Site Rating
// Bench (dental 27, home services 17, restaurants 14, cafes 2). "aimFor" comes from what the 4s and 5s
// in that vertical share; "avoid" from the problems behind its 1s to 3s. Fonts are variable Google
// fonts so next/font can load them without a weight list.

export interface GoogleFont {
  // Family name as Google Fonts spells it
  family: string
  // Export name in next/font/google
  importName: string
}

export interface SiteTheme {
  headingFont: GoogleFont
  bodyFont: GoogleFont
  headingTransform: 'none' | 'uppercase'
  headingTracking: string
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  card: string
  border: string
  accent: string
  // Buttons: 9999px for pills, small values for crisp, decisive buttons
  buttonRadius: string
  cardRadius: string
}

/** overlay: full-bleed photo, text over a soft gradient. panel: photo with a light translucent text panel. centered: centered text over a dimmed photo. */
export type HeroVariant = 'overlay' | 'panel' | 'centered'

export type PrimaryActionKind = 'book' | 'call' | 'schedule' | 'reserve' | 'order' | 'contact'

export interface VerticalProfile {
  id: VerticalId
  label: string
  // The feel the site should have, in a sentence or two
  character: string
  theme: SiteTheme
  hero: { variant: HeroVariant; guidance: string }
  primaryAction: { kind: PrimaryActionKind; label: string }
  // Show the phone number as a tap-to-call button in the header
  headerPhone: boolean
  // What visitors look for first, in the order the home page should answer it
  homeSections: readonly string[]
  trustSignals: readonly string[]
  imagery: string
  tone: string
  aimFor: readonly string[]
  avoid: readonly string[]
  // Provenance: how many bench sites this profile was learned from, and how many of them rated 4-5
  learnedFrom: { rated: number; topRated: number }
}

const font = (family: string): GoogleFont => ({ family, importName: family.replace(/ /g, '_') })

export const VERTICAL_PROFILES: Readonly<Record<VerticalId, VerticalProfile>> = {
  dental: {
    id: 'dental',
    label: 'Dental and orthodontic practice',
    character: 'Calm, warm and trustworthy. The site should feel like a bright, modern office where nervous patients are put at ease: real people, soft light, unhurried type.',
    theme: {
      headingFont: font('Playfair Display'),
      bodyFont: font('Karla'),
      headingTransform: 'none',
      headingTracking: '-0.01em',
      background: '#f7f9fb',
      foreground: '#16212e',
      muted: '#eaf0f4',
      mutedForeground: '#4b5b6b',
      card: '#ffffff',
      border: '#dbe3ea',
      accent: '#e6eef4',
      buttonRadius: '9999px',
      cardRadius: '1rem',
    },
    hero: {
      variant: 'panel',
      guidance: 'Full-width photo of the actual office or team with a soft tint, and the headline on a light, slightly translucent panel or directly on the tint. One elegant serif headline (an italic accent word works well), a short line about who they care for, one appointment button.',
    },
    primaryAction: { kind: 'book', label: 'Book an appointment' },
    headerPhone: true,
    homeSections: ['Who they are and who they care for', 'Services as linked cards', 'New patients: what to expect, insurance and financing', 'Meet the doctor and team', 'Reviews', 'Location, hours and booking'],
    trustSignals: ['Google rating and review count', 'Accepted insurance and financing (CareCredit, Cherry, Sunbit)', 'Years in practice and credentials', 'Languages spoken'],
    imagery: 'Real photos of the office, the doctor and team, and smiling patients. Keep faces in frame on phones. Avoid stock models with perfect teeth and clinical close-ups of tools.',
    tone: 'Warm, reassuring and plain-spoken. Speak to families and anxious patients; no clinical jargon in headlines.',
    aimFor: [
      'An elegant serif for headings over a clean sans for body, with generous line height.',
      'A muted, cool or earthy palette (navy, slate, soft blue, warm sand) with one warm action color for booking.',
      'Phone as a pill button next to a "Book online" button in a single header bar.',
      'A floating header that stays compact, and large readable body text.',
      'Soft gradients that fade the hero into the page.',
    ],
    avoid: [
      'Two or three header bars repeating the address and phone.',
      'A booking button that only dials the phone number shown beside it.',
      'Several floating widgets at once (financing, reviews, chat, accessibility) piling up over content.',
      'A popup on arrival announcing new patients or specials.',
      'Hard square boxes around text and a harsh gradient.',
    ],
    learnedFrom: { rated: 23, topRated: 17 },
  },
  'home-services': {
    id: 'home-services',
    label: 'Home services (plumbing, HVAC, handyman, electrical)',
    character: 'Bold, dependable and quick to act. A homeowner with a problem should see who comes out, that they are trusted locally, and how to get help now.',
    theme: {
      headingFont: font('Montserrat'),
      bodyFont: font('Inter'),
      headingTransform: 'uppercase',
      headingTracking: '0.01em',
      background: '#f6f7f9',
      foreground: '#111827',
      muted: '#e9ecf1',
      mutedForeground: '#4b5563',
      card: '#ffffff',
      border: '#d9dee6',
      accent: '#eef1f5',
      buttonRadius: '0.375rem',
      cardRadius: '0.5rem',
    },
    hero: {
      variant: 'overlay',
      guidance: 'Full-bleed photo of the crew, trucks or work in progress with a strong dark gradient. A short, heavy uppercase headline, one line on years in business and service area, the Google rating badge, and two actions: schedule service and call.',
    },
    primaryAction: { kind: 'schedule', label: 'Schedule service' },
    headerPhone: true,
    homeSections: ['What they fix and where they work', 'Service categories as linked cards (heating, cooling, plumbing, drains)', 'Why choose them: licensed, insured, years in business, 24/7 if offered', 'Reviews', 'Service area', 'Get a quote or schedule'],
    trustSignals: ['Google rating and review count', 'Licensed and insured', 'Years in business and local ownership', '24/7 or emergency service', 'Financing and guarantees'],
    imagery: 'Real technicians, branded trucks and finished work. Avoid cheesy staged stock and photos of the sign.',
    tone: 'Direct and confident. Short sentences, concrete promises (on time, upfront pricing), no fluff.',
    aimFor: [
      'A heavy sans for uppercase headings, a saturated brand color and one loud action color.',
      'The phone number as a button in the header and a schedule button beside it, in one header bar.',
      'A menu of service categories (heating, cooling, plumbing) instead of generic page names.',
      'A rating badge and real selling points (24-hour service, years in business) in the first screen.',
    ],
    avoid: [
      'Three or four stacked header bars and banners repeating the phone number; this was the most common problem in this vertical.',
      'Tiny body text and long walls of service descriptions.',
      'Clashing banner colors over the hero photo.',
      'Plain-text phone numbers that cannot be tapped.',
      'A contact form styled like a 2010 form builder.',
    ],
    learnedFrom: { rated: 12, topRated: 4 },
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant or bar',
    character: 'Atmospheric and appetizing. The site should feel like walking in: the food, the room and the mood first, then the practical details.',
    theme: {
      headingFont: font('Fraunces'),
      bodyFont: font('Source Sans 3'),
      headingTransform: 'none',
      headingTracking: '-0.01em',
      background: '#f4eee6',
      foreground: '#2a2420',
      muted: '#e9e0d4',
      mutedForeground: '#6b5d52',
      card: '#fbf7f1',
      border: '#ddd1c2',
      accent: '#ece3d6',
      buttonRadius: '9999px',
      cardRadius: '0.25rem',
    },
    hero: {
      variant: 'centered',
      guidance: 'Full-bleed food or dining-room photo (or short video) with a soft dark wash, the name or a short welcome centered, address underneath, and one reservation or order button.',
    },
    primaryAction: { kind: 'reserve', label: 'Make a reservation' },
    headerPhone: false,
    homeSections: ['A short welcome: the food and the place', 'Menu highlights with photos, linking to the full menu', 'Hours and location', 'Events or private dining', 'Reserve or order'],
    trustSignals: ['Hours, address and parking right up front', 'Press mentions and awards', 'Reviews'],
    imagery: 'Large, warm, close-up food photography and the real dining room. Never clip-art, paper plates or textured wood backdrops.',
    tone: 'Inviting and specific: name dishes, ingredients and the neighborhood.',
    aimFor: [
      'An elegant display serif on a warm cream background with dark, quiet text.',
      'A short menu (Menu, Our Story, Visit, Events) and a reservation or order button.',
      'Hours and address visible without hunting.',
      'For a small place, one page with anchor links instead of thin separate pages.',
    ],
    avoid: [
      'A popup or full-screen menu image covering the page on arrival.',
      'Jumping straight into the full menu or a single deal with no welcome.',
      'Typewriter, novelty or generic default fonts, and textured backgrounds.',
      'A page inside a directory or another business site instead of its own.',
      'Ordering links that do not work.',
    ],
    learnedFrom: { rated: 11, topRated: 4 },
  },
  cafe: {
    id: 'cafe',
    label: 'Cafe, coffee shop or bakery',
    character: 'Friendly, cozy and a little playful. Warm colors, rounded shapes and real photos of the counter and the regulars.',
    theme: {
      headingFont: font('Nunito'),
      bodyFont: font('DM Sans'),
      headingTransform: 'none',
      headingTracking: '-0.01em',
      background: '#fbf7f0',
      foreground: '#2b2622',
      muted: '#efe6d8',
      mutedForeground: '#6e6257',
      card: '#fffdf9',
      border: '#e6dccd',
      accent: '#f3eadc',
      buttonRadius: '9999px',
      cardRadius: '1.25rem',
    },
    hero: {
      variant: 'overlay',
      guidance: 'Full-bleed photo of drinks, pastries or the room with a warm dark gradient, a friendly headline and an order button.',
    },
    primaryAction: { kind: 'order', label: 'Order online' },
    headerPhone: false,
    homeSections: ['What they serve and what makes them different', 'Menu highlights as rounded photo cards', 'Locations and hours', 'Community and events', 'Order online'],
    trustSignals: ['Locally roasted or baked in house', 'Hours and locations', 'Reviews'],
    imagery: 'Real drinks, pastries, the counter and customers, in rounded frames. Playful brand touches (a mascot line drawing, small icons) are welcome.',
    tone: 'Warm, casual and a little witty.',
    aimFor: [
      'Rounded, friendly headings with a warm accent color (amber, mustard or sage).',
      'Linked cards with faded photo backdrops for the main sections.',
      'Rounded photos and cards, and an order button in the header.',
    ],
    avoid: ['Generic stock coffee photos.', 'Hiding hours and location.'],
    learnedFrom: { rated: 2, topRated: 2 },
  },
  general: {
    id: 'general',
    label: 'Other local business',
    character: 'Clean, current and professional, with the business and its main action clear in the first screen.',
    theme: {
      headingFont: font('Inter'),
      bodyFont: font('Inter'),
      headingTransform: 'none',
      headingTracking: '-0.02em',
      background: '#fafaf9',
      foreground: '#1c1917',
      muted: '#e8e5e0',
      mutedForeground: '#57534e',
      card: '#fffdfb',
      border: '#e0d9d0',
      accent: '#ece8e2',
      buttonRadius: '0.5rem',
      cardRadius: '0.75rem',
    },
    hero: {
      variant: 'overlay',
      guidance: 'Full-bleed photo with a soft gradient, a clear headline saying what the business does, and one main action.',
    },
    primaryAction: { kind: 'contact', label: 'Get in touch' },
    headerPhone: true,
    homeSections: ['What they do and for whom', 'Services', 'Why choose them', 'Reviews', 'Contact'],
    trustSignals: ['Reviews', 'Years in business', 'Credentials'],
    imagery: 'Real photos of the people, place and work.',
    tone: 'Clear and friendly.',
    aimFor: [],
    avoid: [],
    learnedFrom: { rated: 0, topRated: 0 },
  },
}

export const profileFor = (vertical: VerticalId | undefined): VerticalProfile => VERTICAL_PROFILES[vertical ?? 'general']
