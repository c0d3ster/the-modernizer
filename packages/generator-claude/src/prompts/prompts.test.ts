import { describe, expect, it } from 'vitest'
import { PageArchetype } from '@modernizer/schema'
import type { SiteSchema } from '@modernizer/schema'

import { buildPagePrompt } from './page-prompt.js'
import { buildShellPrompt } from './shell-prompt.js'

const site = (overrides: Partial<SiteSchema>): SiteSchema => ({
  rootUrl: 'https://example.com/',
  siteName: 'Example',
  brandColors: { primary: '#1d4ed8' },
  nav: [{ label: 'Contact', url: '/contact' }],
  pages: [{ url: 'https://example.com/', title: 'Home', archetype: PageArchetype.Home, blocks: [] }],
  footer: { phone: '(540) 555-0100' },
  ...overrides,
})

describe('vertical design direction in the Claude prompts', () => {
  it('gives a dental practice its own fonts, header and main action', () => {
    const { cached, task } = buildShellPrompt(site({ siteName: 'Valley Family Dentistry', nav: [{ label: 'New Patients', url: '/new-patients' }] }))
    expect(cached).toContain('## Design Direction (Dental and orthodontic practice)')
    expect(task).toContain('`Playfair_Display` with `variable: \'--font-display\'`')
    expect(task).toContain('"Book an appointment"')
    expect(task).toContain('(540) 555-0100 as a tap-to-call')
    expect(task).toContain('At most 6 top-level links')
  })

  it('leaves the header phone out for a restaurant', () => {
    const { cached, task } = buildShellPrompt(site({ siteName: 'Antica Trattoria', nav: [{ label: 'Menu', url: '/menu' }, { label: 'Reservations', url: '/reservations' }] }))
    expect(cached).toContain('Fraunces')
    expect(task).toContain('"Make a reservation"')
    expect(task).not.toContain('tap-to-call')
  })

  it('uses the vertical set on the schema over detection', () => {
    const { cached } = buildShellPrompt(site({ siteName: 'Valley Family Dentistry', vertical: 'home-services' }))
    expect(cached).toContain('Home services')
  })

  it('forbids invented facts and takes the phone from a contact block when the footer has none', () => {
    const contactPage = { url: 'https://example.com/contact', title: 'Contact', archetype: PageArchetype.Contact, blocks: [{ type: 'contact_info' as const, phone: '540-667-8287' }] }
    const schema = site({ siteName: 'Amos Family Dentistry', footer: undefined, pages: [...site({}).pages, contactPage] })
    const { cached, task } = buildShellPrompt(schema)
    expect(cached).toContain('never use placeholder numbers like 555')
    expect(cached).toContain('- Phone: 540-667-8287')
    expect(task).toContain('540-667-8287 as a tap-to-call')
  })

  it('shares one cached context between the shell and every page', () => {
    const schema = site({ siteName: 'J Hood Plumbing and Heating' })
    const page = schema.pages[0]
    if (!page) throw new Error('fixture has no page')
    expect(buildPagePrompt(schema, page, '').cached).toBe(buildShellPrompt(schema).cached)
  })
})
