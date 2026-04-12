import { describe, it, expect } from 'vitest'
import { buildNav } from './layout-generator.js'
import type { NavItem } from '@modernizer/schema'

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

  it('For the Family collapses to a top-level link (only Client Visitation survives after dedup)', () => {
    // Should NOT appear as a group with children
    const group = result.find((i) => i.label === 'For the Family')
    expect(group).toBeUndefined()
    // Client Visitation should be promoted to top-level
    const promoted = result.find((i) => i.label === 'Client Visitation')
    expect(promoted).toBeDefined()
    expect(promoted?.children).toBeUndefined()
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
