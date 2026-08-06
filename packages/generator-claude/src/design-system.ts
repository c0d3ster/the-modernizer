import { z } from 'zod'
import type { GeneratedFile } from './llm-client.js'

/**
 * Sentinel path the shell call writes its design-tokens hand-off to, as JSON. Not a real project
 * file — extractDesignSystemSpec pulls it out of the shell's output before anything is written
 * to disk. Exists so every page call can be told the exact spacing/card/heading/button
 * conventions the shell already decided on, instead of each page independently improvising its
 * own visual language.
 *
 * The shape is enforced with Zod rather than left as free markdown: an earlier free-text version
 * of this file let the model invent, drop, or rename sections between runs, which made the spec
 * unreviewable and impossible to trust as "the same 11 categories every time." A fixed schema
 * plus a deterministic serializer (below) means the only thing that varies run-to-run is the
 * actual class strings the model picks, not the structure carrying them.
 */
export const DESIGN_SYSTEM_FILE_PATH = '__design-system.json'

export const DesignSystemSpecSchema = z.object({
  container: z.string(),
  sectionSpacing: z.object({
    hero: z.string(),
    standard: z.string(),
    compact: z.string(),
  }),
  card: z.string(),
  headingScale: z.object({
    hero: z.string(),
    section: z.string(),
    sub: z.string(),
  }),
  buttons: z.object({
    primary: z.string(),
    secondary: z.string(),
  }),
  heroTreatment: z.string(),
  iconPresentation: z.string(),
  hoverTransition: z.string(),
  gridLayouts: z.string(),
  commonPatterns: z.string(),
})

export type DesignSystemSpec = z.infer<typeof DesignSystemSpecSchema>

/** Renders a validated spec into the fixed-order markdown block every page prompt reads — same headings, same order, every run. */
const serializeDesignSystemSpec = (spec: DesignSystemSpec): string =>
  `## Container & Layout
- Container: ${spec.container}

## Section Spacing
- Hero sections: ${spec.sectionSpacing.hero}
- Standard sections: ${spec.sectionSpacing.standard}
- Compact sections: ${spec.sectionSpacing.compact}

## Card Style
- ${spec.card}

## Heading Scale
- Hero heading: ${spec.headingScale.hero}
- Section heading: ${spec.headingScale.section}
- Sub-heading: ${spec.headingScale.sub}

## Buttons
- Primary CTA: ${spec.buttons.primary}
- Secondary CTA: ${spec.buttons.secondary}

## Hero Section Treatment
- ${spec.heroTreatment}

## Icon Presentation
- ${spec.iconPresentation}

## Hover & Transition Convention
- ${spec.hoverTransition}

## Grid Layouts
- ${spec.gridLayouts}

## Common Patterns
- ${spec.commonPatterns}`

export interface ExtractedDesignSystem {
  spec: string
  files: GeneratedFile[]
  /** Set when the shell wrote the sentinel file but its content didn't match the schema — distinct from the file being absent entirely. */
  validationError?: string
}

/**
 * Splits the shell call's output into real project files and the design-tokens spec (if the
 * shell call included one). Falls back to an empty spec rather than failing — a run with no
 * cross-page consistency hand-off is degraded, not broken — but surfaces a `validationError`
 * when the file was present and malformed, so that failure mode is visible instead of silently
 * behaving the same as "no spec at all."
 */
export const extractDesignSystemSpec = (files: GeneratedFile[]): ExtractedDesignSystem => {
  const specFile = files.find((f) => f.path === DESIGN_SYSTEM_FILE_PATH)
  const remainingFiles = files.filter((f) => f.path !== DESIGN_SYSTEM_FILE_PATH)

  if (!specFile) return { spec: '', files: remainingFiles }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(specFile.content)
  } catch {
    return { spec: '', files: remainingFiles, validationError: 'not valid JSON' }
  }

  const result = DesignSystemSpecSchema.safeParse(parsedJson)
  if (!result.success) {
    return { spec: '', files: remainingFiles, validationError: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }

  return { spec: serializeDesignSystemSpec(result.data), files: remainingFiles }
}
