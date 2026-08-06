import { describe, expect, it } from 'vitest'
import type { GeneratedFile } from './llm-client.js'
import { DESIGN_SYSTEM_FILE_PATH, extractDesignSystemSpec } from './design-system.js'

const VALID_SPEC = {
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  sectionSpacing: { hero: 'py-16', standard: 'py-12', compact: 'py-8' },
  card: 'bg-card border rounded-lg p-6',
  headingScale: { hero: 'text-6xl font-bold', section: 'text-4xl font-bold', sub: 'text-2xl font-semibold' },
  buttons: { primary: 'default', secondary: 'outline' },
  heroTreatment: 'bg-primary text-primary-foreground min-h-[500px]',
  iconPresentation: 'h-12 w-12 rounded-lg bg-primary/10 text-primary',
  hoverTransition: 'transition-colors duration-200',
  gridLayouts: 'grid grid-cols-1 md:grid-cols-3 gap-6',
  commonPatterns: 'text-center mb-12',
}

describe('extractDesignSystemSpec', () => {
  it('returns an empty spec and unchanged files when the sentinel file is absent', () => {
    const files: GeneratedFile[] = [{ path: 'src/app/layout.tsx', content: 'export default function Layout() {}' }]

    const result = extractDesignSystemSpec(files)

    expect(result.spec).toBe('')
    expect(result.validationError).toBeUndefined()
    expect(result.files).toEqual(files)
  })

  it('strips the sentinel file out of the returned files regardless of validity', () => {
    const files: GeneratedFile[] = [
      { path: 'src/app/layout.tsx', content: 'export default function Layout() {}' },
      { path: DESIGN_SYSTEM_FILE_PATH, content: JSON.stringify(VALID_SPEC) },
    ]

    const result = extractDesignSystemSpec(files)

    expect(result.files).toEqual([{ path: 'src/app/layout.tsx', content: 'export default function Layout() {}' }])
  })

  it('parses and serializes a valid spec into the fixed-order markdown block', () => {
    const files: GeneratedFile[] = [{ path: DESIGN_SYSTEM_FILE_PATH, content: JSON.stringify(VALID_SPEC) }]

    const result = extractDesignSystemSpec(files)

    expect(result.validationError).toBeUndefined()
    expect(result.spec).toContain('## Container & Layout')
    expect(result.spec).toContain('- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8')
    expect(result.spec).toContain('## Common Patterns')
    expect(result.spec).toMatchInlineSnapshot(`
      "## Container & Layout
      - Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

      ## Section Spacing
      - Hero sections: py-16
      - Standard sections: py-12
      - Compact sections: py-8

      ## Card Style
      - bg-card border rounded-lg p-6

      ## Heading Scale
      - Hero heading: text-6xl font-bold
      - Section heading: text-4xl font-bold
      - Sub-heading: text-2xl font-semibold

      ## Buttons
      - Primary CTA: default
      - Secondary CTA: outline

      ## Hero Section Treatment
      - bg-primary text-primary-foreground min-h-[500px]

      ## Icon Presentation
      - h-12 w-12 rounded-lg bg-primary/10 text-primary

      ## Hover & Transition Convention
      - transition-colors duration-200

      ## Grid Layouts
      - grid grid-cols-1 md:grid-cols-3 gap-6

      ## Common Patterns
      - text-center mb-12"
    `)
  })

  it('falls back to an empty spec with a validationError when the sentinel content is not valid JSON', () => {
    const files: GeneratedFile[] = [{ path: DESIGN_SYSTEM_FILE_PATH, content: '## Not JSON, just markdown' }]

    const result = extractDesignSystemSpec(files)

    expect(result.spec).toBe('')
    expect(result.validationError).toBe('not valid JSON')
  })

  it('falls back to an empty spec with a validationError when a required field is missing', () => {
    const { commonPatterns: _commonPatterns, ...incomplete } = VALID_SPEC
    const files: GeneratedFile[] = [{ path: DESIGN_SYSTEM_FILE_PATH, content: JSON.stringify(incomplete) }]

    const result = extractDesignSystemSpec(files)

    expect(result.spec).toBe('')
    expect(result.validationError).toContain('commonPatterns')
  })

  it('falls back to an empty spec with a validationError when a nested field has the wrong type', () => {
    const invalid = { ...VALID_SPEC, sectionSpacing: { ...VALID_SPEC.sectionSpacing, hero: 42 } }
    const files: GeneratedFile[] = [{ path: DESIGN_SYSTEM_FILE_PATH, content: JSON.stringify(invalid) }]

    const result = extractDesignSystemSpec(files)

    expect(result.spec).toBe('')
    expect(result.validationError).toContain('sectionSpacing.hero')
  })
})
