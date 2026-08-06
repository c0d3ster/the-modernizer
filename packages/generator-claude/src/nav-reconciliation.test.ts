import { describe, expect, it } from 'vitest'
import { PageArchetype, type NavItem, type PageSchema } from '@modernizer/schema'
import { reconcileNav } from './nav-reconciliation.js'

const ROOT_URL = 'https://example.com/'

const page = (path: string, title: string): PageSchema => ({
  url: `https://example.com${path}`,
  title,
  archetype: PageArchetype.Generic,
  blocks: [],
})

describe('reconcileNav', () => {
  it('drops a leaf nav item whose page was never crawled', () => {
    const nav: NavItem[] = [{ label: 'About', url: '/about' }, { label: 'Home', url: '/' }]
    const pages = [page('/', 'Home')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'Home', url: '/' }])
  })

  it('repoints a parent whose own link is dead to its first surviving child', () => {
    const nav: NavItem[] = [
      {
        label: 'Services',
        url: '/services',
        children: [
          { label: 'Consulting', url: '/services/consulting' },
          { label: 'Support', url: '/services/support' },
        ],
      },
    ]
    const pages = [page('/services/consulting', 'Consulting'), page('/services/support', 'Support')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([
      {
        label: 'Services',
        url: '/services/consulting',
        children: [
          { label: 'Consulting', url: '/services/consulting' },
          { label: 'Support', url: '/services/support' },
        ],
      },
    ])
  })

  it('drops a parent whose own link is dead and has no surviving children', () => {
    const nav: NavItem[] = [
      { label: 'Services', url: '/services', children: [{ label: 'Legacy', url: '/services/legacy' }] },
      { label: 'Home', url: '/' },
    ]
    const pages = [page('/', 'Home')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'Home', url: '/' }])
  })

  it('keeps a leaf item whose page was crawled', () => {
    const nav: NavItem[] = [{ label: 'About', url: '/about' }]
    const pages = [page('/about', 'About')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'About', url: '/about' }])
  })

  it('leaves external (non-local) nav links untouched even with no matching page', () => {
    const nav: NavItem[] = [{ label: 'Facebook', url: 'https://facebook.com/example' }]
    const pages: PageSchema[] = []

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'Facebook', url: 'https://facebook.com/example' }])
  })

  it('leaves a protocol-relative external link untouched rather than treating it as a dead local route', () => {
    const nav: NavItem[] = [{ label: 'CDN Asset', url: '//cdn.example.com/asset' }]
    const pages: PageSchema[] = []

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'CDN Asset', url: '//cdn.example.com/asset' }])
  })

  it('merges an orphaned page into an existing top-level nav entry sharing its first segment', () => {
    const nav: NavItem[] = [{ label: 'Services', url: '/services/consulting', children: [{ label: 'Consulting', url: '/services/consulting' }] }]
    const pages = [page('/services/consulting', 'Consulting'), page('/services/support', 'Support')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([
      {
        label: 'Services',
        url: '/services/consulting',
        children: [
          { label: 'Consulting', url: '/services/consulting' },
          { label: 'Support', url: '/services/support' },
        ],
      },
    ])
  })

  it('synthesizes a new group for multiple orphaned pages sharing an unrepresented segment', () => {
    const nav: NavItem[] = [{ label: 'Home', url: '/' }]
    const pages = [page('/', 'Home'), page('/about/staff', 'Staff'), page('/about/history', 'History')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([
      { label: 'Home', url: '/' },
      {
        label: 'About',
        url: '/about/staff',
        children: [
          { label: 'Staff', url: '/about/staff' },
          { label: 'History', url: '/about/history' },
        ],
      },
    ])
  })

  it('adds a single orphaned page standalone rather than as a one-item group', () => {
    const nav: NavItem[] = [{ label: 'Home', url: '/' }]
    const pages = [page('/', 'Home'), page('/events', 'Events')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([{ label: 'Home', url: '/' }, { label: 'Events', url: '/events' }])
  })

  it('never treats the root page as orphaned', () => {
    const nav: NavItem[] = []
    const pages = [page('/', 'Home')]

    const result = reconcileNav(nav, pages, ROOT_URL)

    expect(result).toEqual([])
  })
})
