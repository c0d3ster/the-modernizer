import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRateLimiter } from './rate-limiter.js'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not delay the first call', async () => {
    const limit = createRateLimiter(1000)
    const start = Date.now()
    await limit()
    expect(Date.now() - start).toBe(0)
  })

  it('delays a second call until minIntervalMs has elapsed', async () => {
    const limit = createRateLimiter(1000)
    await limit()
    const start = Date.now()

    let resolved = false
    const second = limit().then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await second

    expect(resolved).toBe(true)
    expect(Date.now() - start).toBe(1000)
  })

  it('does not add extra delay when calls are already spaced apart', async () => {
    const limit = createRateLimiter(1000)
    await limit()

    vi.advanceTimersByTime(5000)
    const start = Date.now()
    await limit()

    expect(Date.now() - start).toBe(0)
  })

  it('spaces out concurrent callers instead of releasing them together', async () => {
    const limit = createRateLimiter(1000)
    const start = Date.now()
    const releasedAt: number[] = []

    const calls = [limit(), limit(), limit()].map((call) =>
      call.then(() => {
        releasedAt.push(Date.now() - start)
      })
    )

    await vi.advanceTimersByTimeAsync(2000)
    await Promise.all(calls)

    expect(releasedAt).toEqual([0, 1000, 2000])
  })
})
