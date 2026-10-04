import { mkdtemp, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATES_CSV_HEADER,
  runDiscovery,
  scoreCandidates,
  writeCandidatesCsv,
} from './discover-candidates.js'

// Full pipeline against fabricated fixtures (no live data exists to record): Stage 1 uses a
// fake Places fetch whose website URIs point at an in-process HTTP server serving four
// candidate homepages of varying age, Stage 3 fetches them with the real staticFetch, and
// Wayback/PSI are stubbed so the run is deterministic and offline. The server is plain
// http, so every https probe fails and no_ssl fires for all of them.
const filler = (text: string): string => `<p>${text.repeat(20)}</p>`

const SITES: Record<string, string> = {
  // Every static signal fires: table layout, old jQuery + WP theme, IE meta, no viewport/OG.
  '/old-diner/': `<html><head><title>Old Diner</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <script src="/wp-content/themes/twentyfifteen/js/jquery-1.11.3.min.js"></script>
    </head><body><table><tr><td>Home</td><td>Menu</td></tr></table>
    ${filler('Best diner food in town since 1985. ')}</body></html>`,
  // Mobile-ready but no OG tags.
  '/mid-plumber/': `<html><head><title>Mid Plumber</title>
    <meta name="viewport" content="width=device-width">
    </head><body>${filler('Licensed plumbing for homes and businesses. ')}</body></html>`,
  // Fully modern markup.
  '/modern-dental/': `<html><head><title>Modern Dental</title>
    <meta name="viewport" content="width=device-width">
    <meta property="og:title" content="Modern Dental">
    </head><body>${filler('Gentle family dentistry with same-day appointments. ')}</body></html>`,
  // Too little visible text for staticFetch, so this candidate is unscoreable.
  '/thin-salon/': '<html><body><p>Coming soon</p></body></html>',
}

// Wayback stub keyed by path: the diner last changed in 2016 (capped staleness), the
// plumber in 2024, the dentist has no Wayback data.
const SNAPSHOTS: Record<string, { timestamp: string; digest: string }[]> = {
  '/old-diner/': [{ timestamp: '20160301000000', digest: 'a' }],
  '/mid-plumber/': [{ timestamp: '20240101000000', digest: 'b' }],
}

let server: Server
let baseUrl: string

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      const html = SITES[req.url ?? '/']
      if (html) {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(html)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

const fakePlacesFetch = (): typeof fetch =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({
      places: Object.keys(SITES).map((sitePath, index) => ({
        id: `place-${index}`,
        displayName: { text: sitePath.replaceAll('/', '') },
        websiteUri: `${baseUrl}${sitePath}`,
        userRatingCount: 25,
        rating: 4.5,
        nationalPhoneNumber: `(512) 555-010${index}`,
        formattedAddress: `${index} Main St`,
      })),
    }),
  })) as unknown as typeof fetch

describe('discovery pipeline (integration)', () => {
  it('runs Stages 1-5 and writes a ranked candidates.csv', async () => {
    const { continuing } = await runDiscovery(
      { city: 'Austin', state: 'TX', businessTypes: ['restaurant'] },
      { apiKey: 'test-key', fetchImpl: fakePlacesFetch() }
    )
    expect(continuing).toHaveLength(4)

    const { ranked, unreachable } = await scoreCandidates(continuing, {
      fetchSnapshots: async (lookupUrl) =>
        SNAPSHOTS[new URL(`http://${lookupUrl}`).pathname] ?? [],
      fetchPsi: async (url) =>
        url.includes('modern-dental')
          ? { performance: 95, seo: 100, accessibility: 98, score: 97.9 }
          : null,
      now: new Date('2026-10-04T00:00:00Z'),
    })

    expect(unreachable.map(({ name }) => name)).toEqual(['thin-salon'])
    expect(ranked.map(({ name }) => name)).toEqual([
      'old-diner',
      'mid-plumber',
      'modern-dental',
    ])
    expect(ranked.every(({ staticScore }) => staticScore.noSsl)).toBe(true)

    const outDir = await mkdtemp(path.join(tmpdir(), 'candidates-'))
    const csvPath = path.join(outDir, 'candidates.csv')
    await writeCandidatesCsv(ranked, csvPath)

    const lines = (await readFile(csvPath, 'utf-8')).trim().split('\n')
    expect(lines[0]).toBe(CANDIDATES_CSV_HEADER.join(','))
    expect(lines).toHaveLength(4)

    const scoreColumn = CANDIDATES_CSV_HEADER.indexOf('score')
    const scores = lines
      .slice(1)
      .map((line) => Number(line.split(',')[scoreColumn]))
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
    // Every static signal plus capped staleness fires: 100 - (20+20+20+12+10+10+5+3) = 0
    expect(scores[0]).toBe(0)
  }, 30000)
})
