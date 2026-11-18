import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SiteInspection, ViewInspection } from '@modernizer/schema'

import { inspectSite, launchInspectionBrowser } from './inspect-site.js'
import { INSPECTION_VIEWPORTS, type InspectionViewport } from './viewports.js'

// Each page reproduces a real-site case the detector got wrong at some point, or must keep getting right.
// Vendor files are served from local paths: only the URL matters to detection, nothing is fetched.
const page = (body: string, head = ''): string =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture</title>${head}</head><body>${body}</body></html>`
const filler = '<main style="min-height:100vh"><h1>Family dentistry</h1><p>We have served the valley for twenty years. Call us any time to set up a visit.</p></main>'

const PAGES: Record<string, string> = {
  // Squarespace adds an "opentable-style-dark" class on its own; that is not OpenTable booking.
  '/squarespace': page(`<div class="opentable-style-dark">${filler}</div><script src="/static1.squarespace.com/universal.js"></script>`),
  // A WooCommerce plugin is installed but there is no store to buy from.
  '/woo-plugin': page(`${filler}<script src="/wp-content/plugins/woocommerce/assets/js/frontend.js"></script>`),
  // Toast is restaurant ordering, not table booking.
  '/toast': page(`<nav><a href="https://order.toasttab.com/online/fixture">Order online</a></nav>${filler}`),
  // A wide element with overflow-x hidden on body can't be scrolled to by a visitor.
  '/overflow-hidden': page(`<div style="width:3000px">${filler}</div>`, '<style>html,body{overflow-x:hidden}</style>'),
  '/overflow-real': page(`<div style="width:3000px">${filler}</div>`),
  // The full menu hides below 1400px and only a menu button is left.
  '/menu-collapse': page(
    `<header><nav>${['Home', 'About', 'Services', 'Team', 'Forms', 'Reviews', 'Blog', 'Contact'].map((t) => `<a href="/${t.toLowerCase()}">${t}</a>`).join(' ')}</nav><button class="menu-toggle" aria-label="Menu">=</button></header><a href="tel:5405550100" style="display:inline-block;padding:24px 80px">Call now</a>${filler}`,
    '<style>.menu-toggle{display:none;width:40px;height:40px} @media (max-width:1400px){nav a{display:none} .menu-toggle{display:block}}</style>'
  ),
  '/cookie-banner': page(
    `${filler}<div id="notice" style="position:fixed;left:0;right:0;bottom:0;height:30vh;background:#222;color:#fff">We use cookies to improve your visit. See our privacy policy. <button onclick="document.getElementById('notice').remove()">Accept</button></div>`
  ),
  '/popup': page(
    `${filler}<div role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(0,0,0,.6)"><div style="margin:15vh auto;width:60%;height:50vh;background:#fff">Now accepting new patients!</div></div>`
  ),
  // Wix paints its page background on a full-screen fixed layer behind the content.
  '/fixed-background': page(`<div style="position:fixed;inset:0;z-index:-1;background:#f3e9d2"></div>${filler}`),
  // A transparent full-screen wrapper that only holds a small reviews badge.
  '/transparent-wrapper': page(
    `${filler}<div style="position:fixed;inset:0"><div style="position:absolute;right:16px;bottom:16px;width:120px;height:60px;background:#fff">4.9 stars</div></div>`
  ),
}

const viewports = (...names: InspectionViewport['name'][]): InspectionViewport[] => INSPECTION_VIEWPORTS.filter((v) => names.includes(v.name))
const desktopView = (inspection: SiteInspection): ViewInspection | undefined => inspection.views.find((v) => v.viewport === 'desktop')

const isAddressInfo = (address: string | AddressInfo | null): address is AddressInfo => typeof address === 'object' && address !== null

let server: Server
let origin = ''
let browser: Browser | null = null

beforeAll(async () => {
  server = createServer((req, res) => {
    const html = PAGES[req.url ?? '']
    res.writeHead(html ? 200 : 404, { 'content-type': html ? 'text/html' : 'text/plain' })
    res.end(html ?? '')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!isAddressInfo(address)) throw new Error('fixture server has no port')
  origin = `http://127.0.0.1:${address.port}`
  // Skip, rather than fail, where no Chromium is installed (set MODERNIZER_CHROMIUM_PATH to use another build)
  browser = await launchInspectionBrowser().catch(() => null)
}, 60_000)

afterAll(async () => {
  await browser?.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const inspect = async (route: string, names: InspectionViewport['name'][], screenshotDir?: string): Promise<SiteInspection> => {
  if (!browser) throw new Error('no browser')
  return inspectSite(`${origin}${route}`, { browser, viewports: viewports(...names), screenshotDir, slug: route.slice(1) })
}

describe('inspectSite', { timeout: 60_000 }, () => {
  it('does not read a Squarespace style class as OpenTable booking', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspect('/squarespace', ['desktop'])
    expect(desktopView(result)?.features?.booking).toBeNull()
    expect(result.projectFeatures.map((f) => f.feature)).toContain('cms_integration')
    expect(result.projectFeatures.map((f) => f.feature)).not.toContain('online_booking')
  })

  it('does not count a WooCommerce plugin without a store as e-commerce', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspect('/woo-plugin', ['desktop'])
    expect(desktopView(result)?.features?.ordering).toBeNull()
    expect(result.projectFeatures.map((f) => f.feature)).not.toContain('ecommerce_platform_integration')
  })

  it('reports Toast as online ordering, not booking', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspect('/toast', ['desktop'])
    expect(desktopView(result)?.features?.booking).toBeNull()
    expect(result.projectFeatures).toContainEqual({ feature: 'ecommerce_platform_integration', label: 'E-Commerce Platform Integration', detail: 'Online ordering (Toast)' })
  })

  it('reports sideways scroll only when a visitor can actually scroll', async (ctx) => {
    if (!browser) return ctx.skip()
    const hidden = await inspect('/overflow-hidden', ['desktop'])
    expect(desktopView(hidden)?.features?.overflowPx).toBe(0)
    const real = await inspect('/overflow-real', ['desktop'])
    expect(desktopView(real)?.features?.overflowPx).toBeGreaterThan(20)
  })

  it('notices a menu that collapses at small-laptop width', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspect('/menu-collapse', ['desktop', 'small'])
    expect(result.smallLaptopIssues).toEqual(['Menu collapses to a menu button (8 links down to 0)'])
  })

  it('reports a cookie banner and keeps a screenshot of the page as loaded', async (ctx) => {
    if (!browser) return ctx.skip()
    const dir = await mkdtemp(path.join(tmpdir(), 'inspect-'))
    try {
      const result = await inspect('/cookie-banner', ['desktop'], dir)
      const view = desktopView(result)
      expect(view?.covered).toHaveLength(1)
      expect(view?.covered[0]).toMatchObject({ kind: 'cookie banner', where: 'bottom' })
      expect(view?.covered[0]?.pct).toBeGreaterThanOrEqual(25)
      expect(view?.screenshots.map((s) => s.position)).toEqual(['loaded', 'top', 'scrolled'])
      expect(result.coverage[0]?.text).toMatch(/^Cookie banner covers \d+% of the first screen \(bottom\)$/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('reports a modal popup over the whole first screen', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspect('/popup', ['desktop'])
    expect(desktopView(result)?.covered[0]).toMatchObject({ kind: 'popup', pct: 100, where: 'full screen', label: 'Now accepting new patients!' })
  })

  it('ignores a fixed background layer and a transparent widget wrapper', async (ctx) => {
    if (!browser) return ctx.skip()
    const background = await inspect('/fixed-background', ['desktop'])
    expect(desktopView(background)?.covered).toEqual([])
    const wrapper = await inspect('/transparent-wrapper', ['desktop'])
    expect(desktopView(wrapper)?.covered.filter((c) => c.kind === 'popup')).toEqual([])
  })

  it('returns the failure in the view instead of throwing when a page will not load', async (ctx) => {
    if (!browser) return ctx.skip()
    const result = await inspectSite('http://127.0.0.1:9/unreachable', { browser, viewports: viewports('desktop'), gotoTimeoutMs: 5_000 })
    expect(desktopView(result)?.error).toBeTruthy()
    expect(desktopView(result)?.features).toBeNull()
    expect(result.projectFeatures).toEqual([])
  })
})
