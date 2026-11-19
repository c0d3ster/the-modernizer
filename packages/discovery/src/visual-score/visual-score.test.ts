import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SiteInspection } from '@modernizer/schema'

import { pageFeatures } from '../inspect/test-fixtures.js'
import { describeInspectionFacts } from './inspection-facts.js'
import { visualScoreSystemPrompt } from './prompts/visual-score.js'
import { DESIGN_RULES } from '@modernizer/design-guide'
import { buildVisualScoreRequest, parseVisualScore, visualScoreInputFromInspection } from './visual-score.js'

const inspection = (overrides: Partial<SiteInspection> = {}): SiteInspection => ({
  url: 'https://example.com/',
  finalUrl: 'https://example.com/',
  capturedAt: '2026-11-18T00:00:00.000Z',
  blocked: false,
  views: [
    {
      viewport: 'desktop',
      width: 1536,
      height: 864,
      status: 200,
      visibleChars: 900,
      features: pageFeatures({ menuLinks: ['Home', 'About'], ctas: [{ text: 'Book now', goesTo: 'starts a phone call' }], telInFold: true, fonts: ['Poppins'] }),
      covered: [],
      screenshots: [
        { position: 'loaded', path: 'shots/d-loaded.jpg' },
        { position: 'top', path: 'shots/d-top.jpg' },
        { position: 'scrolled', path: 'shots/d-scrolled.jpg' },
      ],
    },
    {
      viewport: 'mobile',
      width: 375,
      height: 812,
      status: 200,
      visibleChars: 700,
      features: pageFeatures({ menuButton: true, overflowPx: 140 }),
      covered: [],
      screenshots: [{ position: 'top', path: 'shots/m-top.jpg' }],
    },
    {
      viewport: 'small',
      width: 1366,
      height: 768,
      status: 200,
      visibleChars: 900,
      features: pageFeatures(),
      covered: [],
      screenshots: [{ position: 'top', path: 'shots/s-top.jpg' }],
    },
  ],
  projectFeatures: [{ feature: 'reviews', label: 'Reviews & Testimonials', detail: 'Elfsight widget' }],
  smallLaptopIssues: [],
  coverage: [{ viewport: 'mobile', kind: 'cookie banner', text: 'Cookie banner covers 72% of the first screen (bottom)' }],
  ...overrides,
})

const validScore = {
  unassessable: false,
  overall: 3,
  pitch: 'yes',
  issues: ['cluttered', 'overlay'],
  findings: [
    { ruleId: 'header-bars', extent: 'full', count: 2, where: 'both', evidence: 'Three header bars above the hero' },
    { ruleId: 'overlay-cookie-heavy', extent: 'partial', count: null, where: 'phone', evidence: 'Cookie banner covers a third of the phone screen' },
  ],
  strengths: ['Real photos of the office'],
  cantJudge: ['Hover effects'],
  note: 'Three header bars push the hero down, and a cookie banner covers most of the phone screen.',
}

describe('rubric', () => {
  it('gives every rule a unique id and puts every rule in the prompt', () => {
    const ids = DESIGN_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const prompt = visualScoreSystemPrompt()
    for (const id of ids) expect(prompt).toContain(`[${id}]`)
  })

  it('keeps per-site values out of the system prompt so it caches', () => {
    expect(visualScoreSystemPrompt()).toBe(visualScoreSystemPrompt())
  })
})

describe('describeInspectionFacts', () => {
  it('lists what a rater needs: menu, buttons, coverage, sideways scroll and existing features', () => {
    const facts = describeInspectionFacts(inspection())
    expect(facts).toContain('Laptop menu: 2 links in the first screen (Home, About)')
    expect(facts).toContain('"Book now" (starts a phone call)')
    expect(facts).not.toContain('plain text')
    expect(facts).toContain('Phone page scrolls sideways by 140px')
    expect(facts).toContain('Phone: Cookie banner covers 72% of the first screen (bottom)')
    expect(facts).toContain('Reviews & Testimonials (Elfsight widget)')
    expect(facts).not.toContain('not the home page')
  })

  it('flags when the listed link is not the home page', () => {
    expect(describeInspectionFacts(inspection({ finalUrl: 'https://example.com/locations/winchester/' }))).toContain('not the home page')
  })
})

describe('visualScoreInputFromInspection', () => {
  it('orders screenshots laptop then phone and skips the small-laptop view when nothing changes there', () => {
    const { images } = visualScoreInputFromInspection(inspection())
    expect(images.map((i) => i.path)).toEqual(['shots/d-loaded.jpg', 'shots/d-top.jpg', 'shots/d-scrolled.jpg', 'shots/m-top.jpg'])
  })

  it('adds the small-laptop view when something breaks at that width', () => {
    const { images } = visualScoreInputFromInspection(inspection({ smallLaptopIssues: ['Menu drops from 8 links to 5'] }))
    expect(images.at(-1)).toEqual({ label: 'Small laptop (1366px), top of page', path: 'shots/s-top.jpg' })
  })
})

describe('buildVisualScoreRequest', () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'visual-'))
    await writeFile(path.join(dir, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('labels each screenshot, caches the system prompt and forces the scoring tool', async () => {
    const request = await buildVisualScoreRequest({ images: [{ label: 'Laptop, top of page', path: path.join(dir, 'a.jpg') }], facts: '- Page: x' })
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'record_visual_score' })
    expect(Array.isArray(request.system) && request.system[0]?.cache_control).toEqual({ type: 'ephemeral' })
    const [message] = request.messages
    const content = Array.isArray(message?.content) ? message.content : []
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text'])
    expect(content[0]).toEqual({ type: 'text', text: 'Laptop, top of page:' })
  })
})

describe('parseVisualScore', () => {
  it('accepts a valid score and computes points from the findings', () => {
    const score = parseVisualScore(validScore)
    expect(score.overall).toBe(3)
    expect(score.deductions).toEqual([
      { ruleId: 'header-bars', points: 10 },
      { ruleId: 'overlay-cookie-heavy', points: 4 },
    ])
    expect(score.points).toBe(86)
  })

  it('rejects issue tags outside the bench vocabulary', () => {
    expect(() => parseVisualScore({ ...validScore, issues: ['ugly'] })).toThrow()
  })

  it('drops any rating on an unassessable site', () => {
    expect(parseVisualScore({ ...validScore, unassessable: true })).toMatchObject({ overall: null, pitch: null, points: null, deductions: [] })
  })

  it('requires a rating on an assessable site', () => {
    expect(() => parseVisualScore({ ...validScore, overall: null })).toThrow(/missing a rating/)
  })
})
