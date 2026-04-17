import { type Browser, chromium } from 'playwright'

let browser: Browser | null = null
let launching: Promise<Browser> | null = null

const getBrowser = async (): Promise<Browser> => {
  if (browser?.isConnected()) return browser
  if (launching) return launching

  launching = chromium.launch({ headless: false }).then((b) => {
    browser = b
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
  }
}

export interface PlaywrightFetchResult {
  html: string
  statusCode: number
  finalUrl: string
}

export const playwrightFetch = async (url: string): Promise<PlaywrightFetchResult | null> => {
  const b = await getBrowser()
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
