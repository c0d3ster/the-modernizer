import { beforeEach, describe, expect, it, vi } from 'vitest'

const { inspectSite, scoreSiteVisually, close } = vi.hoisted(() => ({
  inspectSite: vi.fn(),
  scoreSiteVisually: vi.fn(),
  close: vi.fn(),
}))

vi.mock('../inspect/inspect-site.js', () => ({
  inspectSite,
  launchInspectionBrowser: async (): Promise<{ close: typeof close }> => ({ close }),
}))
vi.mock('./visual-score.js', () => ({
  scoreSiteVisually,
  visualScoreInputFromInspection: (inspection: { images: string[] }): { images: string[] } => ({ images: inspection.images }),
}))

import { createVisualScorer } from './visual-scorer.js'

const usage = { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, estimatedCostUsd: 0.03 }

describe('createVisualScorer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scores a site and tracks spend', async () => {
    inspectSite.mockResolvedValue({ blocked: false, images: ['a.jpg'] })
    scoreSiteVisually.mockResolvedValue({ score: { unassessable: false, points: 64 }, usage })
    const scorer = createVisualScorer({ screenshotDir: 'shots' })
    expect(await scorer.score('https://a.test', 'a')).toEqual({ points: 64, costUsd: 0.03 })
    expect(scorer.costUsd()).toBeCloseTo(0.03)
    await scorer.close()
    expect(close).toHaveBeenCalledOnce()
  })

  it('returns null for blocked, empty, unassessable or failing sites without throwing', async () => {
    const onError = vi.fn()
    const scorer = createVisualScorer({ screenshotDir: 'shots', onError })
    inspectSite.mockResolvedValueOnce({ blocked: true, images: ['a.jpg'] })
    expect(await scorer.score('https://blocked.test', 'b')).toBeNull()
    inspectSite.mockResolvedValueOnce({ blocked: false, images: [] })
    expect(await scorer.score('https://blank.test', 'c')).toBeNull()
    inspectSite.mockResolvedValueOnce({ blocked: false, images: ['a.jpg'] })
    scoreSiteVisually.mockResolvedValueOnce({ score: { unassessable: true, points: null }, usage })
    expect(await scorer.score('https://bot.test', 'd')).toBeNull()
    inspectSite.mockRejectedValueOnce(new Error('net::ERR_NAME_NOT_RESOLVED\nstack'))
    expect(await scorer.score('https://gone.test', 'e')).toBeNull()
    expect(onError).toHaveBeenCalledWith('https://gone.test', 'net::ERR_NAME_NOT_RESOLVED')
  })

  it('never runs more inspections at once than the limit', async () => {
    let running = 0
    let peak = 0
    inspectSite.mockImplementation(async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return { blocked: false, images: ['a.jpg'] }
    })
    scoreSiteVisually.mockResolvedValue({ score: { unassessable: false, points: 90 }, usage })
    const scorer = createVisualScorer({ screenshotDir: 'shots', concurrency: 2 })
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((s) => scorer.score(`https://${s}.test`, s)))
    expect(peak).toBe(2)
  })
})
