import { describe, expect, it } from 'vitest'

import {
  computeStaleness,
  computeStalenessWeightFromYears,
} from './staleness.js'

describe('computeStalenessWeightFromYears', () => {
  it('scales continuously within the first year', () => {
    expect(computeStalenessWeightFromYears(0)).toBe(0)
    expect(computeStalenessWeightFromYears(0.5)).toBe(2)
  })

  it('matches the documented table at whole-year marks', () => {
    expect(computeStalenessWeightFromYears(1)).toBe(4)
    expect(computeStalenessWeightFromYears(2)).toBe(8)
    expect(computeStalenessWeightFromYears(3)).toBe(12)
    expect(computeStalenessWeightFromYears(4)).toBe(16)
  })

  it('caps at 20 for 5+ years', () => {
    expect(computeStalenessWeightFromYears(5)).toBe(20)
    expect(computeStalenessWeightFromYears(12)).toBe(20)
  })

  it('never goes negative for a future date', () => {
    expect(computeStalenessWeightFromYears(-1)).toBe(0)
  })
})

describe('computeStaleness', () => {
  const now = new Date('2026-01-01T00:00:00Z')

  it('returns last_changed and a staleness weight from the most recent CDX snapshot', async () => {
    const fetchSnapshots = async () => [
      { timestamp: '20180101000000', digest: 'AAA' },
      { timestamp: '20220101000000', digest: 'BBB' },
    ]

    const result = await computeStaleness(
      'https://example.com',
      '<html></html>',
      { fetchSnapshots, now }
    )

    expect(result.source).toBe('wayback')
    expect(result.lastChanged).toBe('2022-01-01')
    expect(result.stalenessWeight).toBe(16)
  })

  it('uses the single snapshot when only one exists', async () => {
    const fetchSnapshots = async () => [
      { timestamp: '20210101000000', digest: 'AAA' },
    ]

    const result = await computeStaleness(
      'https://example.com',
      '<html></html>',
      { fetchSnapshots, now }
    )

    expect(result.source).toBe('wayback')
    expect(result.lastChanged).toBe('2021-01-01')
    expect(result.stalenessWeight).toBeCloseTo(20, 1)
  })

  it('falls back to the copyright year regex when Wayback has no data', async () => {
    const fetchSnapshots = async () => []
    const html = '<footer>© 2016 Example Co.</footer>'

    const result = await computeStaleness('https://example.com', html, {
      fetchSnapshots,
      now,
    })

    expect(result).toEqual({
      lastChanged: null,
      stalenessWeight: 10,
      source: 'copyright-fallback',
    })
  })

  it('falls back gracefully with no signal when neither Wayback nor copyright regex match', async () => {
    const fetchSnapshots = async () => []
    const html = '<footer>All rights reserved.</footer>'

    const result = await computeStaleness('https://example.com', html, {
      fetchSnapshots,
      now,
    })

    expect(result).toEqual({
      lastChanged: null,
      stalenessWeight: 0,
      source: 'none',
    })
  })
})
