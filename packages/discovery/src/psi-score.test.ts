import { describe, expect, it, vi } from 'vitest'

import { computePsiScore, fetchPsiScore, PSI_SCORE_WEIGHTS } from './psi-score.js'

const buildPsiResponse = (categories: {
  performance: number
  seo: number
  accessibility: number
}): unknown => ({
  lighthouseResult: {
    categories: {
      performance: { score: categories.performance },
      seo: { score: categories.seo },
      accessibility: { score: categories.accessibility },
    },
  },
})

describe('computePsiScore', () => {
  it('matches the documented weighted-average formula for fixture category scores', () => {
    const categories = { performance: 40, seo: 90, accessibility: 70 }
    const expected =
      categories.performance * PSI_SCORE_WEIGHTS.performance +
      categories.seo * PSI_SCORE_WEIGHTS.seo +
      categories.accessibility * PSI_SCORE_WEIGHTS.accessibility

    expect(computePsiScore(categories)).toBeCloseTo(expected)
  })

  it('scores 100 when every category is a perfect 100', () => {
    expect(
      computePsiScore({ performance: 100, seo: 100, accessibility: 100 })
    ).toBeCloseTo(100)
  })

  it('scores 0 when every category is 0', () => {
    expect(
      computePsiScore({ performance: 0, seo: 0, accessibility: 0 })
    ).toBe(0)
  })
})

describe('fetchPsiScore', () => {
  it('returns null without calling fetch when no API key is available', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchPsiScore('https://example.com', {
      apiKey: undefined,
      fetchImpl,
    })

    expect(result).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns null when the PSI API responds with a non-ok status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    const result = await fetchPsiScore('https://example.com', {
      apiKey: 'test-key',
      fetchImpl,
    })

    expect(result).toBeNull()
  })

  it('returns null for a malformed/partial response missing a required category', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          categories: {
            performance: { score: 0.5 },
            seo: { score: 0.9 },
            // accessibility missing
          },
        },
      }),
    })

    const result = await fetchPsiScore('https://example.com', {
      apiKey: 'test-key',
      fetchImpl,
    })

    expect(result).toBeNull()
  })

  it('returns null when fetch rejects (network error)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const result = await fetchPsiScore('https://example.com', {
      apiKey: 'test-key',
      fetchImpl,
    })

    expect(result).toBeNull()
  })

  it('parses a well-formed response and combines categories into the PSI score', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildPsiResponse({ performance: 0.4, seo: 0.9, accessibility: 0.7 }),
    })

    const result = await fetchPsiScore('https://example.com', {
      apiKey: 'test-key',
      fetchImpl,
    })

    expect(result).not.toBeNull()
    expect(result?.performance).toBeCloseTo(40)
    expect(result?.seo).toBeCloseTo(90)
    expect(result?.accessibility).toBeCloseTo(70)
    expect(result?.score).toBeCloseTo(computePsiScore({ performance: 40, seo: 90, accessibility: 70 }))

    const requestedUrl = fetchImpl.mock.calls[0]?.[0] as string
    expect(requestedUrl).toContain('strategy=mobile')
    expect(requestedUrl).toContain('key=test-key')
  })
})
