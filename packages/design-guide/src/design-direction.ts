import { PATTERN_RULES, PROBLEM_RULES } from './rubric.js'
import type { VerticalProfile } from './verticals.js'

// Problems worth naming to a generator: the ones that cost real points on the bench. Smaller design
// choices are left to the vertical's own guidance.
const GENERATOR_PROBLEM_MIN_POINTS = 6

const bullets = (items: readonly string[]): string => items.map((i) => `- ${i}`).join('\n')

/**
 * Markdown design direction for a generator prompt: the vertical's character and conventions, then
 * the rubric's good patterns and costly problems. Deterministic for a given profile, so it caches.
 */
export const designDirection = (profile: VerticalProfile): string => {
  const { theme, hero, primaryAction } = profile
  const problems = PROBLEM_RULES.filter((r) => (r.scoring.type === 'fixed' ? r.scoring.points : r.scoring.max) >= GENERATOR_PROBLEM_MIN_POINTS)

  return `## Design Direction (${profile.label})
Learned from hand-rated local sites in this vertical: follow it so the site has the character of the business, not a generic template.

${profile.character}

### Look
- Headings: ${theme.headingFont.family}${theme.headingTransform === 'uppercase' ? ', uppercase' : ''}; body: ${theme.bodyFont.family}. Both are already loaded in the root layout as \`font-heading\` and \`font-sans\`.
- Neutrals are already set in the theme for this vertical (background ${theme.background}, cards ${theme.card}); the brand color is the primary. ${theme.buttonRadius === '9999px' ? 'Buttons are pill-shaped.' : 'Buttons have small, crisp corners.'}
- Hero: ${hero.guidance}
- Imagery: ${profile.imagery}
- Tone of the copy: ${profile.tone}

### Structure
- Main action everywhere: "${primaryAction.label}"${profile.headerPhone ? ', with the phone number as a tap-to-call button in the header' : ''}. One header bar, sticky, full width.
- Home page, in this order:
${profile.homeSections.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- Trust signals to surface where the content has them:
${profile.trustSignals.map((s) => `  - ${s}`).join('\n')}

### What the best sites in this vertical do
${bullets([...profile.aimFor, ...PATTERN_RULES.map((r) => r.rule)])}

### What cost sites the most points (never do these)
${bullets([...profile.avoid, ...problems.map((r) => r.rule)])}`
}
