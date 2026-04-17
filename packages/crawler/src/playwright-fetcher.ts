import { type Browser, chromium } from 'playwright'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null
let launchedHeadless: boolean | null = null

/** Parses typical shell boolean env values (true/false, 1/0, yes/no, on/off). */
const envBool = (raw: string | undefined): boolean | undefined => {
  if (raw === undefined || raw === '') return undefined
  const s = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(s)) return true
  if (['0', 'false', 'no', 'off'].includes(s)) return false
  return undefined
}

/** Headful by default (better Cloudflare bypass); set MODERNIZER_HEADLESS or pass explicit true for CI. */
export const resolvePlaywrightHeadless = (explicit?: boolean): boolean => {
  if (explicit !== undefined) return explicit
  return envBool(process.env.MODERNIZER_HEADLESS) ?? false
}

const getBrowser = async (headless: boolean): Promise<Browser> => {
  if (browser?.isConnected() && launchedHeadless === headless) {
    return browser
  }

  if (browser) {
    await browser.close()
    browser = null
    launchedHeadless = null
  }

  if (launching) {
    const previous = await launching
    if (previous.isConnected() && launchedHeadless === headless) {
      return previous
    }
    await previous.close()
    browser = null
    launchedHeadless = null
  }

  launching = chromium.launch({ headless }).then((b) => {
    browser = b
    launchedHeadless = headless
    launching = null
    return b
  })

  return launching
}

export const closeBrowser = async (): Promise<void> => {
  if (launching) await launching
  if (browser) {
    await browser.close()
    browser = null
    launchedHeadless = null
  }
}

export interface PlaywrightFetchResult {
  html: string
  statusCode: number
  finalUrl: string
}

export const playwrightFetch = async (
  url: string,
  options: { headless: boolean }
): Promise<PlaywrightFetchResult | null> => {
  const b = await getBrowser(options.headless)
  const page = await b.newPage()
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const html = await page.content()
    const finalUrl = page.url()
    const statusCode = response?.status() ?? 200
    return { html, statusCode, finalUrl }
  } catch {
    return null
  } finally {
    await page.close()
  }
}
