import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { type Browser, type Page, chromium } from 'playwright'
import { pageFeaturesSchema, siteInspectionSchema } from '@modernizer/schema'
import type { CoverageItem, PageFeatures, Screenshot, SiteInspection, ViewInspection } from '@modernizer/schema'
import { detectCoverage } from './browser/detect-coverage.js'
import { detectFeatures } from './browser/detect-features.js'
import { measureHeaderBands } from './browser/measure-header.js'
import { headerSticks } from './browser/header-sticks.js'
import { dismissConsent, scrollOneScreen, visibleText, warmUp } from './browser/page-actions.js'
import { coverageNotes, coversDesign } from './coverage.js'
import { detectProjectFeatures } from './project-features.js'
import { smallLaptopIssues } from './small-laptop.js'
import { INSPECTION_VIEWPORTS, type InspectionViewport } from './viewports.js'

// Text a bot check or block page shows instead of the site
const CHALLENGE = /performing security verification|access denied|you have been blocked|403 forbidden|attention required|checking your browser|just a moment/i
// esbuild (tsx, vitest) wraps named functions in __name(...) calls. Functions passed to page.evaluate
// carry those calls into the page, so give the page a no-op __name.
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f)'

const DEFAULT_GOTO_TIMEOUT_MS = 45_000
const DEFAULT_VIEW_TIMEOUT_MS = 90_000
const LOAD_TIMEOUT_MS = 15_000
const SETTLE_MS = 2_500
const SCREENSHOT_TIMEOUT_MS = 15_000

export interface InspectSiteOptions {
  browser: Browser
  // Where to write screenshots. Leave out to skip them.
  screenshotDir?: string
  // File name prefix for screenshots, e.g. "morgan-orthodontics"
  slug?: string
  ignoreTlsErrors?: boolean
  gotoTimeoutMs?: number
  // Hard limit per viewport, so one hung page can't stall a whole run
  viewTimeoutMs?: number
  viewports?: readonly InspectionViewport[]
}

/**
 * Launches the headless Chromium used for inspection. Set MODERNIZER_CHROMIUM_PATH (or pass
 * executablePath) when the Chromium build Playwright expects isn't installed.
 */
export const launchInspectionBrowser = ({ executablePath }: { executablePath?: string } = {}): Promise<Browser> =>
  chromium.launch({ headless: true, executablePath: executablePath ?? process.env.MODERNIZER_CHROMIUM_PATH })

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err)).split('\n')[0]?.slice(0, 140) ?? ''

const screenshot = async (page: Page, dir: string | undefined, file: string, position: Screenshot['position'], into: Screenshot[]): Promise<void> => {
  if (!dir) return
  const target = path.join(dir, file)
  await page.screenshot({ path: target, type: 'jpeg', quality: 70, timeout: SCREENSHOT_TIMEOUT_MS })
  into.push({ position, path: target })
}

const readFeatures = async (page: Page): Promise<{ features: PageFeatures | null; error?: string }> => {
  try {
    const headerBands = await page.evaluate(measureHeaderBands).catch(() => undefined)
    const parsed = pageFeaturesSchema.safeParse({ ...(await page.evaluate(detectFeatures)), ...(headerBands && { headerBands }) })
    if (parsed.success) return { features: parsed.data }
    return { features: null, error: `feature detection returned an unexpected shape: ${parsed.error.issues[0]?.path.join('.') ?? ''}` }
  } catch (err) {
    return { features: null, error: errorMessage(err) }
  }
}

interface ViewResult {
  view: ViewInspection
  finalUrl: string | null
  blocked: boolean
}

const inspectView = async (url: string, vp: InspectionViewport, options: InspectSiteOptions): Promise<ViewResult> => {
  const { browser, screenshotDir, slug = 'site', ignoreTlsErrors = false } = options
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: ignoreTlsErrors,
  })
  await context.addInitScript({ content: NAME_SHIM })
  const page = await context.newPage()
  page.on('dialog', (dialog) => {
    dialog.dismiss().catch(() => undefined)
  })
  const guard = setTimeout(() => {
    context.close().catch(() => undefined)
  }, options.viewTimeoutMs ?? DEFAULT_VIEW_TIMEOUT_MS)

  const screenshots: Screenshot[] = []
  const view: ViewInspection = {
    viewport: vp.name,
    width: vp.width,
    height: vp.height,
    status: null,
    visibleChars: 0,
    features: null,
    covered: [],
    screenshots,
  }
  let finalUrl: string | null = null
  let blocked = false
  const shot = (position: Screenshot['position']): Promise<void> => screenshot(page, screenshotDir, `${slug}-${vp.name}-${position}.jpg`, position, screenshots)

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.gotoTimeoutMs ?? DEFAULT_GOTO_TIMEOUT_MS })
    await page.waitForLoadState('load', { timeout: LOAD_TIMEOUT_MS }).catch(() => undefined)
    await page.waitForTimeout(SETTLE_MS)
    view.status = response?.status() ?? null
    finalUrl = page.url()
    const text = await page.evaluate(visibleText).catch(() => '')
    view.visibleChars = text.trim().length
    blocked = CHALLENGE.test(text.slice(0, 2000))

    // What covers the page as a visitor first sees it, before anything is dismissed
    const covered: CoverageItem[] = await page.evaluate(detectCoverage).catch(() => [])
    view.covered = covered
    if (coversDesign(covered)) await shot('loaded')

    await page.evaluate(dismissConsent)
    await page.evaluate(warmUp)
    await page.evaluate(dismissConsent)
    await page.waitForTimeout(600)
    const { features, error } = await readFeatures(page)
    view.features = features
    if (error) view.error = error

    await shot('top')
    if (vp.topOnly) return { view, finalUrl, blocked }
    await page.evaluate(scrollOneScreen)
    await page.waitForTimeout(1500)
    view.headerSticks = await page.evaluate(headerSticks).catch(() => undefined)
    await shot('scrolled')
  } catch (err) {
    view.error = errorMessage(err)
  } finally {
    clearTimeout(guard)
    await context.close().catch(() => undefined)
  }
  return { view, finalUrl, blocked }
}

/**
 * Loads a site's home page at each inspection viewport in a real browser and reports what a visitor
 * sees: features already on the site (mapped to c0d3ster ProjectFeature values), what covers the
 * first screen on load, and what breaks at small-laptop width. Screenshots are written when
 * screenshotDir is given. Never throws for a site that fails to load; the failure is in view.error.
 */
export const inspectSite = async (url: string, options: InspectSiteOptions): Promise<SiteInspection> => {
  if (options.screenshotDir) await mkdir(options.screenshotDir, { recursive: true })
  const results: ViewResult[] = []
  for (const vp of options.viewports ?? INSPECTION_VIEWPORTS) {
    results.push(await inspectView(url, vp, options))
  }
  const views = results.map((r) => r.view)
  const featuresOf = (name: ViewInspection['viewport']): PageFeatures | null => views.find((v) => v.viewport === name)?.features ?? null
  const laptop = featuresOf('desktop')
  const small = featuresOf('small')

  return siteInspectionSchema.parse({
    url,
    finalUrl: results.find((r) => r.finalUrl)?.finalUrl ?? null,
    capturedAt: new Date().toISOString(),
    blocked: results.some((r) => r.blocked),
    views,
    projectFeatures: detectProjectFeatures({ laptop, mobile: featuresOf('mobile'), small }),
    smallLaptopIssues: smallLaptopIssues(laptop, small),
    coverage: coverageNotes(views),
  })
}
