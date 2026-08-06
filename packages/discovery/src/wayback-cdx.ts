import { createRateLimiter } from './rate-limiter.js'

const CDX_ENDPOINT = 'https://web.archive.org/cdx/search/cdx'
// Free API, no key required, but must be rate-limited to avoid being blocked (1 req/sec is safe).
const CDX_RATE_LIMIT_MS = 1000

const rateLimit = createRateLimiter(CDX_RATE_LIMIT_MS)

export interface CdxSnapshot {
  timestamp: string
  digest: string
}

// `collapse=digest` returns only the first snapshot for each unique content digest, in
// ascending timestamp order — effectively a list of every time the content changed.
export const fetchCdxSnapshots = async (
  url: string
): Promise<CdxSnapshot[]> => {
  await rateLimit()

  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,digest',
    limit: '50',
    from: '20150101',
    collapse: 'digest',
  })

  try {
    const response = await fetch(`${CDX_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return []

    const text = await response.text()
    if (!text.trim()) return []

    const rows = JSON.parse(text) as unknown
    if (!Array.isArray(rows) || rows.length < 2) return []

    // First row is the header (["timestamp","digest"]); every row after is a snapshot.
    return rows.slice(1).map((row) => {
      const [timestamp, digest] = row as [string, string]
      return { timestamp, digest }
    })
  } catch {
    return []
  }
}
