// Generic rate-limiting gate: `await limit()` before each call to enforce a minimum
// spacing between successive calls. First call never waits.
export type RateLimiter = () => Promise<void>

export const createRateLimiter = (minIntervalMs: number): RateLimiter => {
  let lastCallAt: number | null = null

  return async (): Promise<void> => {
    const now = Date.now()
    if (lastCallAt !== null) {
      const wait = minIntervalMs - (now - lastCallAt)
      if (wait > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, wait))
      }
    }
    lastCallAt = Date.now()
  }
}
