import { type Browser, chromium } from 'playwright'

let browser: Browser | null = null

const getBrowser = async (): Promise<Browser> => {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

export const closeBrowser = async (): Promise<void> => {
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
  try {
    const b = await getBrowser()
    const page = await b.newPage()

    let statusCode = 200
    page.on('response', (response) => {
      if (response.url() === url || response.url() === `${url}/`) {
        statusCode = response.status()
      }
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const html = await page.content()
    const finalUrl = page.url()
    await page.close()

    return { html, statusCode, finalUrl }
  } catch {
    return null
  }
}
