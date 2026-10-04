// Generic rate-limiting gate: `await limit()` before each call to enforce a minimum
// spacing between successive calls. First call never waits.
//
// Safe under concurrent callers: each call reserves the next free slot synchronously
// before awaiting, so N callers arriving in the same tick are spaced minIntervalMs apart
// rather than all waking together after one interval.
export type RateLimiter = () => Promise<void>

export const createRateLimiter = (minIntervalMs: number): RateLimiter => {
  let nextSlotAt: number | null = null

  return async (): Promise<void> => {
    const now = Date.now()
    const slot = nextSlotAt === null ? now : Math.max(now, nextSlotAt)
    nextSlotAt = slot + minIntervalMs

    const wait = slot - now
    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait))
    }
  }
}
