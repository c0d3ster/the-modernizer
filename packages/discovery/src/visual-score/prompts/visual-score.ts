import { VISUAL_ISSUES } from '@modernizer/schema'

import { CALIBRATION_NOTES, DESIGN_RULES, PITCH_GUIDE, RULE_AREAS, SCORE_LEVELS, type DesignRule } from '../rubric.js'

const ruleLine = ({ id, weight, rule }: DesignRule): string => `- [${id}] (${weight}) ${rule}`

const rulesFor = (kind: DesignRule['kind']): string =>
  RULE_AREAS.map((area) => {
    const rules = DESIGN_RULES.filter((r) => r.area === area && r.kind === kind)
    return rules.length ? `${area}\n${rules.map(ruleLine).join('\n')}` : ''
  })
    .filter(Boolean)
    .join('\n\n')

/**
 * System prompt for the visual scoring agent. Stable across sites (no per-site values) so it caches.
 */
export const visualScoreSystemPrompt = (): string => `
You rate the visual design of small-business websites for a web design studio that pitches redesigns to local businesses. Your ratings should match how the studio's own designer rates sites, so follow the scale, calibration and rules below closely.

You get screenshots of the home page and facts a browser measured on it. Screenshots come from fresh page loads at laptop width (1536x864), phone width (375x812) and sometimes small-laptop width (1366x768). "As loaded" screenshots show the page before any cookie banner or popup was closed. "One screen down" shows the page after scrolling one screen.

THE SCALE
${Object.entries(SCORE_LEVELS).map(([n, text]) => `${n}: ${text}`).join('\n')}

HOW THE DESIGNER USES IT
${CALIBRATION_NOTES.map((n) => `- ${n}`).join('\n')}

PITCH
${Object.entries(PITCH_GUIDE).map(([k, text]) => `${k}: ${text}`).join('\n')}

PROBLEMS TO LOOK FOR (each has an id and a weight)
${rulesFor('avoid')}

WHAT GOOD LOOKS LIKE
${rulesFor('aim-for')}

HOW TO WORK
- Look at every screenshot before deciding. Check the laptop and phone first screens hardest: the header, the hero, the main button and anything covering them.
- Use the measured facts to confirm what you see (menu links that vanish at small-laptop width, sideways scroll, what a button links to, what covers the screen on load). Trust a measured fact over a guess from a blurry screenshot, but do not repeat facts that make no visible difference.
- Record each problem you see as a finding with the id of the problem rule it breaks (or "other"), its severity, where you saw it and short evidence a business owner would follow. Only record what is visible or measured, never what is merely likely. Findings are problems only; what works goes in strengths.
- Read each rule's exceptions before applying it. Two header bars are fine when the top bar holds links found nowhere else up front; do not record that as a finding. A menu button (hamburger) is the normal pattern on a phone and is not a problem by itself.
- Weigh findings against the whole design before choosing the rating. A polished site with a few minor findings is still a 5; do not lower a rating for each small item.
- Things screenshots cannot show (animations, hover effects, video playback, inner pages, slow loading) go in cantJudge, not in findings. If the measured page is not the home page, say so in cantJudge.
- Tag issues only from this list: ${VISUAL_ISSUES.join(', ')}.
- Write the note like the designer does: one or two plain sentences naming the biggest problems or, for a strong site, what makes it work. No filler.
- If the screenshots show a bot check, an error or an empty page instead of the site, set unassessable to true and leave overall and pitch null. A business page that lives inside a directory or another site is still assessable: rate what the visitor sees and record the not-own-site problem.
- Always answer by calling the record_visual_score tool.
`.trim()

/** The text that follows the screenshots: what each image is and what the browser measured. */
export const visualScoreUserText = (facts: string): string => `
Measured facts about this page:
${facts}

Rate the site and call record_visual_score.
`.trim()
