import { CALIBRATION_NOTES, PATTERN_RULES, PITCH_GUIDE, PROBLEM_RULES, RULE_AREAS, SCORE_LEVELS } from '@modernizer/design-guide'
import type { DesignRule, ProblemRule } from '@modernizer/design-guide'
import { VISUAL_ISSUES } from '@modernizer/schema'

const pointsLabel = ({ scoring }: ProblemRule): string =>
  scoring.type === 'per-unit'
    ? `-${scoring.points} per ${scoring.unit}, up to -${scoring.max}; set count`
    : `-${scoring.points}, partial -${scoring.partial}`

const byArea = <T extends DesignRule>(rules: readonly T[], line: (rule: T) => string): string =>
  RULE_AREAS.map((area) => {
    const inArea = rules.filter((r) => r.area === area)
    return inArea.length ? `${area}\n${inArea.map(line).join('\n')}` : ''
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

PROBLEMS TO LOOK FOR (each has an id and the points it costs; a site starts at 100)
${byArea(PROBLEM_RULES, (r) => `- [${r.id}] (${pointsLabel(r)}) ${r.rule}`)}

WHAT GOOD LOOKS LIKE
${byArea(PATTERN_RULES, (r) => `- [${r.id}] ${r.rule}`)}

HOW TO WORK
- Look at every screenshot before deciding. Check the laptop and phone first screens hardest: the header, the hero, the main button and anything covering them.
- Use the measured facts to confirm what you see (menu links that vanish at small-laptop width, sideways scroll, what a button links to, what covers the screen on load). Trust a measured fact over a guess from a blurry screenshot, but do not repeat facts that make no visible difference.
- Record each problem you see as a finding with the id of the problem rule it breaks (or "other"), where you saw it and short evidence a business owner would follow. Set extent to "partial" when the problem is only partly there (the rule says when), otherwise "full". For counted rules set count as the rule describes; for every other rule set count to null. Points are computed from your findings, so record a problem only when a visitor would actually notice it, never what is merely likely. Findings are problems only; what works goes in strengths.
- Read each rule's exceptions before applying it. A second header bar that holds unique links costs nothing (count 0, or leave it out). A menu button (hamburger) is the normal pattern on a phone and is not a problem by itself.
- Weigh findings against the whole design before choosing the 1-5 rating. A polished site with a few minor findings is still a 5; do not lower a rating for each small item.
- Things screenshots cannot show (animations, hover effects, video playback, inner pages, slow loading) go in cantJudge, not in findings. If the measured page is not the home page, say so in cantJudge.
- Tag issues only from this list: ${VISUAL_ISSUES.join(', ')}.
- Write the note like the designer does: one or two plain sentences naming the biggest problems or, for a strong site, what makes it work. No filler.
- If the screenshots show a bot check, an error or an empty page instead of the site, set unassessable to true and leave overall and pitch null. A business page that lives inside a directory or another site is still assessable: rate what the visitor sees and record the not-own-site problem.
- Always answer by calling the record_visual_score tool.
`.trim()

/** The text that follows the screenshots: what each image is and what the browser measured. */
export const visualScoreUserText = (facts: string, today: Date = new Date()): string => `
Today is ${today.toISOString().slice(0, 10)}.

Measured facts about this page:
${facts}

Rate the site and call record_visual_score.
`.trim()
