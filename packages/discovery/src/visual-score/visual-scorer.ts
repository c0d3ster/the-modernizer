import type { Browser } from 'playwright'
import { inspectSite, launchInspectionBrowser } from '../inspect/inspect-site.js'
import { scoreSiteVisually, visualScoreInputFromInspection } from './visual-score.js'
import type { VisualScoreOptions } from './visual-score.js'

export interface VisualOutcome {
  points: number
  costUsd: number
}

export interface VisualScorer {
  // null when the site can't be judged: blocked, no screenshots, unassessable, or an error
  score: (url: string, slug: string) => Promise<VisualOutcome | null>
  close: () => Promise<void>
  // Running total of model spend, for the end-of-run summary
  costUsd: () => number
}

export interface VisualScorerOptions {
  screenshotDir: string
  // Browser inspections at once; each holds a Chromium page, so keep this small
  concurrency?: number
  scoreOptions?: VisualScoreOptions
  onError?: (url: string, message: string) => void
}

/**
 * Inspects and scores sites in a batch with one shared headless browser, launched on first use.
 * Never throws for a single site: a failure is reported through `onError` and scored as null, so
 * the composite falls back to the other signals.
 */
export const createVisualScorer = ({ screenshotDir, concurrency = 2, scoreOptions, onError }: VisualScorerOptions): VisualScorer => {
  let browser: Promise<Browser> | null = null
  let active = 0
  let spent = 0
  const waiting: Array<() => void> = []

  const acquire = async (): Promise<void> => {
    if (active < concurrency) {
      active++
      return
    }
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  const release = (): void => {
    const next = waiting.shift()
    if (next) next()
    else active--
  }

  const score = async (url: string, slug: string): Promise<VisualOutcome | null> => {
    await acquire()
    try {
      browser ??= launchInspectionBrowser()
      const inspection = await inspectSite(url, { browser: await browser, screenshotDir, slug })
      if (inspection.blocked) return null
      const input = visualScoreInputFromInspection(inspection)
      if (!input.images.length) return null
      const { score: visual, usage } = await scoreSiteVisually(input, scoreOptions)
      spent += usage.estimatedCostUsd
      if (visual.unassessable || visual.points === null) return null
      return { points: visual.points, costUsd: usage.estimatedCostUsd }
    } catch (err) {
      onError?.(url, (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? '')
      return null
    } finally {
      release()
    }
  }

  const close = async (): Promise<void> => {
    if (browser) await (await browser).close()
    browser = null
  }

  return { score, close, costUsd: () => spent }
}
