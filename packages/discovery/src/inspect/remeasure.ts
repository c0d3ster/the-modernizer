import type { Browser } from 'playwright'
import type { SiteInspection } from '@modernizer/schema'

import { headerSticks } from './browser/header-sticks.js'
import { measureHeaderBands } from './browser/measure-header.js'
import { dismissConsent, scrollOneScreen, warmUp } from './browser/page-actions.js'

// globalThis.__name shim for code tsx compiles into page.evaluate callbacks
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f)'

/**
 * Re-measures the laptop facts added after an inspection was saved (header bands and whether the
 * header stays pinned), without retaking screenshots. Lets an old eval set gain new measurements
 * for free. Leaves the inspection unchanged when the page fails to load.
 */
export const remeasureLaptop = async (inspection: SiteInspection, browser: Browser): Promise<SiteInspection> => {
  const context = await browser.newContext({ viewport: { width: 1536, height: 864 } })
  await context.addInitScript({ content: NAME_SHIM })
  try {
    const page = await context.newPage()
    await page.goto(inspection.finalUrl ?? inspection.url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined)
    await page.waitForTimeout(2500)
    await page.evaluate(dismissConsent)
    await page.evaluate(warmUp)
    await page.evaluate(dismissConsent)
    await page.waitForTimeout(600)
    const headerBands = await page.evaluate(measureHeaderBands)
    await page.evaluate(scrollOneScreen)
    await page.waitForTimeout(1500)
    const sticks = await page.evaluate(headerSticks)
    return {
      ...inspection,
      views: inspection.views.map((v) =>
        v.viewport === 'desktop' ? { ...v, headerSticks: sticks, features: v.features ? { ...v.features, headerBands } : v.features } : v
      ),
    }
  } catch {
    return inspection
  } finally {
    await context.close()
  }
}
