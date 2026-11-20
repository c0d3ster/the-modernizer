import { describe, expect, it } from 'vitest'
import { PageArchetype } from '@modernizer/schema'

import { demoteMainLandmark, generateClaudeLayout } from './layout.js'

describe('generateClaudeLayout', () => {
  const layout = generateClaudeLayout({
    rootUrl: 'https://correllfirm.com/',
    siteName: 'Correll Law Firm, PC',
    brandColors: { primary: '#3068c0' },
    nav: [],
    pages: [{ url: 'https://correllfirm.com/', title: 'Home', archetype: PageArchetype.Home, blocks: [] }],
    heroImageUrl: 'https://correllfirm.com/hero.jpg',
  })

  it('wraps every page in one main landmark between the navbar and footer', () => {
    expect(layout).toMatch(/<Navbar \/>\s*<main id='main-content'>\{children\}<\/main>\s*<Footer \/>/)
  })

  it('sets share tags from the business domain', () => {
    expect(layout).toContain('metadataBase: new URL("https://correllfirm.com")')
    expect(layout).toContain('"https://correllfirm.com/hero.jpg"')
  })
})

describe('demoteMainLandmark', () => {
  it('turns page-level main elements into divs and leaves look-alikes alone', () => {
    const page = `<main className='bg-muted'>\n  <MainHero />\n  <section data-main='x' />\n</main>`
    expect(demoteMainLandmark(page)).toBe(`<div className='bg-muted'>\n  <MainHero />\n  <section data-main='x' />\n</div>`)
  })
})
