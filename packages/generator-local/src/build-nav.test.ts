import { describe, it, expect } from 'vitest'
import { buildNav, navLabelFor, navSource, visibleNavCount } from './layout-generator.js'
import { PageArchetype } from '@modernizer/schema'
import type { NavItem, SiteSchema } from '@modernizer/schema'

const rootUrl = 'https://edgehillrecovery.org/'

// Mirrors the actual Edgehill schema nav (duplicates and all)
const edgehillNav: NavItem[] = [
  {
    label: 'Our Facility',
    url: '#',
    children: [
      { label: 'The Center', url: 'https://edgehillrecovery.org/our-facility/the-center/' },
      { label: 'Our Community', url: 'https://edgehillrecovery.org/our-facility/our-communitywinchester/' },
    ],
  },
  {
    label: 'For the Client',
    url: '#',
    children: [
      { label: 'Our Residential Program', url: 'https://edgehillrecovery.org/for-the-client/our-residential-program/' },
      { label: 'What to Bring', url: 'https://edgehillrecovery.org/for-the-client/what-to-bring/' },
      { label: 'Daily Schedule', url: 'https://edgehillrecovery.org/for-the-client/what-to-bring/daily-schedule/' },
      { label: 'Payment Info', url: 'https://edgehillrecovery.org/payment-info/' },
      // duplicate of Our Facility > Our Community
      { label: 'Our Community', url: 'https://edgehillrecovery.org/our-facility/our-communitywinchester/' },
    ],
  },
  {
    label: 'For the Family',
    url: '#',
    children: [
      { label: 'Client Visitation', url: 'https://edgehillrecovery.org/for-the-family/client-visitation/' },
      // duplicate of For the Client > Daily Schedule
      { label: 'Daily Schedule', url: 'https://edgehillrecovery.org/for-the-client/what-to-bring/daily-schedule/' },
    ],
  },
  {
    label: 'Support Us',
    url: 'https://edgehillrecovery.org/support-usnon-profit/',
    children: [
      { label: 'Contributions', url: 'https://edgehillrecovery.org/support-usnon-profit/contributions/' },
      { label: 'General Donations', url: 'https://edgehillrecovery.org/support-usnon-profit/donations/' },
      { label: "Donations 'In Memory Of'", url: 'https://edgehillrecovery.org/support-usnon-profit/donations-in-memory-of/' },
    ],
  },
]

// All pages that were actually crawled
const crawledPages = new Set([
  '/',
  '/our-facility/the-center',
  '/our-facility/our-communitywinchester',
  '/for-the-client/our-residential-program',
  '/for-the-client/what-to-bring',
  '/for-the-client/what-to-bring/daily-schedule',
  '/payment-info',
  '/for-the-family/client-visitation',
  '/support-usnon-profit',
  '/support-usnon-profit/contributions',
  '/support-usnon-profit/donations',
  '/support-usnon-profit/donations-in-memory-of',
])

describe('buildNav (Edgehill)', () => {
  const result = buildNav(edgehillNav, rootUrl, crawledPages, 7)

  it('produces 4 top-level items', () => {
    expect(result).toHaveLength(4)
  })

  it('Our Facility keeps both children', () => {
    const group = result.find((i) => i.label === 'Our Facility')
    expect(group?.children?.map((c) => c.label)).toEqual(['The Center', 'Our Community'])
  })

  it('For the Client dedupes Our Community (already in Our Facility)', () => {
    const group = result.find((i) => i.label === 'For the Client')
    const labels = group?.children?.map((c) => c.label) ?? []
    expect(labels).not.toContain('Our Community')
    expect(labels).toContain('Our Residential Program')
    expect(labels).toContain('Daily Schedule')
  })

  it('For the Family collapses to a top-level link using parent label pointing to sole child URL', () => {
    const item = result.find((i) => i.label === 'For the Family')
    expect(item).toBeDefined()
    expect(item?.children).toBeUndefined()
    expect(item?.url).toBe('/for-the-family/client-visitation')
    // Should NOT appear under its own child label
    expect(result.find((i) => i.label === 'Client Visitation')).toBeUndefined()
  })

  it('Support Us keeps all 3 children', () => {
    const group = result.find((i) => i.label === 'Support Us')
    expect(group?.children).toHaveLength(3)
  })

  it('homepage (/) is excluded from all items', () => {
    const allUrls = result.flatMap((i) => [i.url, ...(i.children?.map((c) => c.url) ?? [])])
    expect(allUrls).not.toContain('/')
  })

  it('no URL appears more than once across the full tree', () => {
    const allUrls = result.flatMap((i) => [i.url, ...(i.children?.map((c) => c.url) ?? [])])
    const realUrls = allUrls.filter((u) => u !== '#')
    expect(new Set(realUrls).size).toBe(realUrls.length)
  })

  it('all child URLs are relative paths', () => {
    const childUrls = result.flatMap((i) => i.children?.map((c) => c.url) ?? [])
    childUrls.forEach((url) => expect(url).not.toContain('https://'))
  })
})

describe('buildNav (external top-level)', () => {
  const nav: NavItem[] = [{ label: 'Partner', url: 'https://example.org/partner' }]
  const crawled = new Set(['/local-only'])

  it('keeps external top-level links that are not in the crawled set', () => {
    const result = buildNav(nav, 'https://mysite.com/', crawled, 7)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: 'Partner', url: 'https://example.org/partner' })
  })
})

describe('navSource', () => {
  const page = (url: string, title: string): SiteSchema['pages'][number] => ({ url, title, archetype: PageArchetype.Generic, blocks: [] })

  it('uses the extracted menu when there is one', () => {
    const nav = [{ label: 'About', url: '/about' }]
    expect(navSource({ nav, pages: [], rootUrl: 'https://example.com/', siteName: 'Amos Family Dentistry' })).toBe(nav)
  })

  it('builds a menu from the crawled pages when extraction found none', () => {
    const pages = [page('https://example.com/', 'Home'), page('https://example.com/about', 'About Dr. Amos | Amos Family Dentistry'), page('https://example.com/services', 'Services – Amos Family Dentistry')]
    expect(navSource({ nav: [], pages, rootUrl: 'https://example.com/', siteName: 'Amos Family Dentistry' })).toEqual([
      { label: 'About Dr. Amos', url: 'https://example.com/about' },
      { label: 'Services', url: 'https://example.com/services' },
    ])
  })

  it('drops the business name and falls back to the URL slug for long SEO titles', () => {
    expect(navLabelFor('Urgent Care - MEADOW BRANCH ANIMAL HOSPITAL', '/urgent-care.html', 'Meadow Branch Animal Hospital')).toBe('Urgent Care')
    expect(navLabelFor('MEADOW BRANCH ANIMAL HOSPITAL - Meadow Branch Animal Hospital Announcements & Blog', '/blog.html', 'Meadow Branch Animal Hospital')).toBe('Blog')
    expect(navLabelFor('Professional Frame Repair Services in Winchester, VA', '/frame-repair', "Robbie's Auto Body")).toBe('Frame Repair')
    expect(navLabelFor('Winchester Car Accident Attorney', '/car-accident-lawyer', 'Correll Law Firm')).toBe('Car Accident Lawyer')
  })
})

describe('fallback menu cleanup', () => {
  const page = (url: string, title: string): SiteSchema['pages'][number] => ({ url, title, archetype: PageArchetype.Generic, blocks: [] })

  it('drops shared edge words, shortens labels and leaves out legal pages', () => {
    const pages = [
      page('https://law.example/', 'Home'),
      page('https://law.example/winchester-medical-malpractice-attorney', 'Winchester Medical Malpractice Attorney'),
      page('https://law.example/winchester-car-accident-lawyer', 'Winchester Car Accident Lawyer'),
      page('https://law.example/winchester-pedestrian-accident-attorney', 'Winchester Pedestrian Accident Attorney'),
      page('https://law.example/tou-and-privacy', 'TOU and Privacy'),
    ]
    expect(navSource({ nav: [], pages, rootUrl: 'https://law.example/', siteName: 'Correll Law Firm' }).map((n) => n.label)).toEqual([
      'Medical Malpractice',
      'Car Accident Lawyer',
      'Pedestrian Accident',
    ])
  })

  it('shows only as many links as fit the bar', () => {
    expect(visibleNavCount(['About', 'Services', 'Reviews', 'Contact'])).toBe(4)
    expect(visibleNavCount(['Frame Repair Specialist', 'Auto Body Paint Experts', 'Aluminum Auto Body Repair', 'Windshield And Glass'])).toBe(2)
  })
})
