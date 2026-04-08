import { readFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateSite } from './index.js'
import type { SiteSchema } from '@modernizer/schema'

// Synthetic fixture — fictional bakery site, no real client data
const fixture: SiteSchema = {
  rootUrl: 'https://example-bakery.com/',
  siteName: 'Sunrise Bakery',
  tagline: 'Fresh from the oven, every morning.',
  brandColors: { primary: '#b45309', background: '#fffbf5', text: '#ffffff' },
  nav: [
    { label: 'About', url: '/about' },
    { label: 'Menu', url: '/menu' },
    { label: 'Contact', url: '/contact' },
  ],
  pages: [
    {
      url: 'https://example-bakery.com/',
      title: 'Home',
      archetype: 'home',
      metaDescription: 'Fresh bread and pastries baked daily.',
      blocks: [
        {
          type: 'hero',
          heading: 'Fresh bread, every morning',
          subheading: 'Handcrafted sourdough baked daily in our stone oven.',
          ctaText: 'See our menu',
          ctaUrl: '/menu',
        },
        {
          type: 'stats',
          stats: [
            { value: '30+', label: 'Years baking' },
            { value: '12', label: 'Bread varieties' },
          ],
        },
        {
          type: 'feature_grid',
          heading: 'Why people come back',
          features: [
            { title: 'Stone-oven baked', description: 'A crust you can\'t fake.' },
            { title: 'Local ingredients', description: 'Flour from a mill 20 miles away.' },
          ],
        },
        {
          type: 'cta',
          heading: 'Order ahead for the weekend',
          subheading: 'We sell out fast.',
          ctaText: 'Place an order',
          ctaUrl: '/contact',
        },
      ],
    },
    {
      url: 'https://example-bakery.com/about',
      title: 'About Us',
      archetype: 'about',
      blocks: [
        {
          type: 'text_section',
          heading: 'Our story',
          body: 'Sunrise Bakery opened in 1993.\n\nToday the founders\' daughter runs the ovens.',
        },
        {
          type: 'team_grid',
          heading: 'The team',
          members: [
            { name: 'Ana Reyes', role: 'Head Baker' },
            { name: 'Tom Reyes', role: 'Founder' },
          ],
        },
      ],
    },
    {
      url: 'https://example-bakery.com/contact',
      title: 'Contact',
      archetype: 'contact',
      blocks: [
        {
          type: 'contact_info',
          heading: 'Find us',
          phone: '+1 (555) 012-3456',
          email: 'hello@example-bakery.com',
          address: '42 Maple Street, Brookfield, MA 01506',
        },
        {
          type: 'faq',
          heading: 'Common questions',
          items: [
            { question: 'What time do you open?', answer: 'We open at 7am Tuesday through Sunday.' },
            { question: 'Do you do custom orders?', answer: 'Yes, email us 3 days in advance.' },
          ],
        },
      ],
    },
  ],
}

const outputDir = join(tmpdir(), `modernizer-test-${Date.now()}`)

const read = (relPath: string): Promise<string> => readFile(join(outputDir, relPath), 'utf8')
const exists = async (relPath: string): Promise<boolean> => {
  try {
    await access(join(outputDir, relPath))
    return true
  } catch {
    return false
  }
}

describe('generateSite', () => {
  beforeAll(async () => {
    await generateSite(fixture, outputDir)
  })

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true })
  })

  describe('config files', () => {
    it('writes package.json with correct site name', async () => {
      const pkg = JSON.parse(await read('package.json'))
      expect(pkg.name).toBe('sunrise-bakery')
      expect(pkg.dependencies).toHaveProperty('next')
      expect(pkg.devDependencies).toHaveProperty('tailwindcss')
    })

    it('writes next.config.ts', async () => {
      const content = await read('next.config.ts')
      expect(content).toContain('poweredByHeader: false')
      expect(content).toContain('reactStrictMode: true')
    })

    it('writes tsconfig.json with @/ path alias', async () => {
      const tsconfig = JSON.parse(await read('tsconfig.json'))
      expect(tsconfig.compilerOptions.paths).toEqual({ '@/*': ['./src/*'] })
    })

    it('writes postcss, prettier, eslint configs', async () => {
      expect(await exists('postcss.config.mjs')).toBe(true)
      expect(await exists('prettier.config.mjs')).toBe(true)
      expect(await exists('eslint.config.mjs')).toBe(true)
    })
  })

  describe('global styles', () => {
    it('injects brand primary color into globals.css', async () => {
      const css = await read('src/app/globals.css')
      expect(css).toContain('--color-primary: #b45309')
      expect(css).toContain('--color-background: #fffbf5')
    })
  })

  describe('app layout', () => {
    it('writes layout.tsx with site name and nav', async () => {
      const layout = await read('src/app/layout.tsx')
      expect(layout).toContain("title: 'Sunrise Bakery'")
      expect(layout).toContain("label: 'About'")
      expect(layout).toContain("label: 'Menu'")
      expect(layout).toContain("siteName='Sunrise Bakery'")
    })

    it('imports Navbar and Footer', async () => {
      const layout = await read('src/app/layout.tsx')
      expect(layout).toContain("from '@/components/layout/Navbar'")
      expect(layout).toContain("from '@/components/layout/Footer'")
    })
  })

  describe('page generation', () => {
    it('generates home page at src/app/page.tsx', async () => {
      const page = await read('src/app/page.tsx')
      expect(page).toContain("from '@/components/blocks/HeroBlock'")
      expect(page).toContain("from '@/components/blocks/StatsBlock'")
      expect(page).toContain("from '@/components/blocks/FeatureGridBlock'")
      expect(page).toContain("from '@/components/blocks/CTABlock'")
      expect(page).toContain('export default HomePage')
    })

    it('inlines block data in home page JSX', async () => {
      const page = await read('src/app/page.tsx')
      expect(page).toContain('Fresh bread, every morning')
      expect(page).toContain('Stone-oven baked')
    })

    it('generates about page at src/app/about/page.tsx', async () => {
      const page = await read('src/app/about/page.tsx')
      expect(page).toContain("from '@/components/blocks/TextSectionBlock'")
      expect(page).toContain("from '@/components/blocks/TeamGridBlock'")
      expect(page).toContain('export default AboutPage')
    })

    it('generates contact page at src/app/contact/page.tsx', async () => {
      const page = await read('src/app/contact/page.tsx')
      expect(page).toContain("from '@/components/blocks/ContactInfoBlock'")
      expect(page).toContain("from '@/components/blocks/FAQBlock'")
      expect(page).toContain('export default ContactPage')
    })

    it('deduplicates block imports on the same page', async () => {
      const page = await read('src/app/page.tsx')
      const heroImports = page.match(/from '@\/components\/blocks\/HeroBlock'/g) ?? []
      expect(heroImports).toHaveLength(1)
    })
  })

  describe('component library', () => {
    it('copies shadcn primitives', async () => {
      expect(await exists('src/components/shadcn/button.tsx')).toBe(true)
      expect(await exists('src/components/shadcn/card.tsx')).toBe(true)
      expect(await exists('src/components/shadcn/accordion.tsx')).toBe(true)
    })

    it('copies all block components', async () => {
      expect(await exists('src/components/blocks/HeroBlock.tsx')).toBe(true)
      expect(await exists('src/components/blocks/FAQBlock.tsx')).toBe(true)
      expect(await exists('src/components/blocks/GenericSection.tsx')).toBe(true)
    })

    it('copies layout components', async () => {
      expect(await exists('src/components/layout/Navbar.tsx')).toBe(true)
      expect(await exists('src/components/layout/Footer.tsx')).toBe(true)
    })

    it('rewrites monorepo imports to @/ aliases in copied components', async () => {
      const hero = await read('src/components/blocks/HeroBlock.tsx')
      expect(hero).not.toContain('@modernizer/schema')
      expect(hero).not.toContain("from '../shadcn/")
      expect(hero).toContain("from '@/types/schema'")
      expect(hero).toContain("from '@/components/shadcn/")
    })

    it('copies schema types', async () => {
      expect(await exists('src/types/schema/blocks.ts')).toBe(true)
      expect(await exists('src/types/schema/index.ts')).toBe(true)
    })
  })
})
