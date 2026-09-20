import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./rate-limiter.js', () => ({
  createRateLimiter: () => async (): Promise<void> => {},
}))

const { fetchCdxSnapshots } = await import('./wayback-cdx.js')

describe('fetchCdxSnapshots', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('parses snapshots, skipping the header row', async () => {
    const body = JSON.stringify([
      ['timestamp', 'digest'],
      ['20180101000000', 'AAA'],
      ['20220601000000', 'BBB'],
    ])
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(body, { status: 200 }))

    const snapshots = await fetchCdxSnapshots('https://example.com')
    expect(snapshots).toEqual([
      { timestamp: '20180101000000', digest: 'AAA' },
      { timestamp: '20220601000000', digest: 'BBB' },
    ])
  })

  it('returns an empty array when Wayback has no data for the URL', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('[]', { status: 200 }))
    expect(await fetchCdxSnapshots('https://example.com')).toEqual([])
  })

  it('returns an empty array when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    expect(await fetchCdxSnapshots('https://example.com')).toEqual([])
  })

  it('returns an empty array when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    expect(await fetchCdxSnapshots('https://example.com')).toEqual([])
  })
})
