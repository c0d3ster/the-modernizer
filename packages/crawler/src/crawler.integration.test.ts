import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { crawl } from './crawler.js'

// Small in-process HTTP server with 4 linked pages
const PAGES: Record<string, string> = {
  '/': `<html><head><title>Home</title></head><body>
    <nav><a href="/about">About</a><a href="/services">Services</a></nav>
    <main><p>${'Welcome to our site. '.repeat(20)}</p></main>
  </body></html>`,

  '/about': `<html><head><title>About Us</title></head><body>
    <nav><a href="/">Home</a><a href="/contact">Contact</a></nav>
    <main><p>${'We are a company that does things. '.repeat(20)}</p></main>
  </body></html>`,

  '/services': `<html><head><title>Services</title></head><body>
    <nav><a href="/">Home</a></nav>
    <main><p>${'We offer many services. '.repeat(20)}</p></main>
  </body></html>`,

  '/contact': `<html><head><title>Contact</title></head><body>
    <nav><a href="/">Home</a></nav>
    <main><p>${'Get in touch with us today. '.repeat(20)}</p></main>
  </body></html>`,
}

let server: Server
let baseUrl: string

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      const path = req.url ?? '/'
      const html = PAGES[path]
      if (html) {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(html)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

describe('crawl (integration)', () => {
  it('discovers all 4 pages from the seed URL', async () => {
    const results = await crawl(baseUrl, { respectRobotsTxt: false, delayMs: 0 })
    expect(results.length).toBe(4)
  }, 30000)

  it('each result has required fields', async () => {
    const results = await crawl(baseUrl, { respectRobotsTxt: false, delayMs: 0 })
    for (const result of results) {
      expect(result.url).toBeTruthy()
      expect(result.rawHtml).toBeTruthy()
      expect(result.title).toBeTruthy()
      expect(result.fetchMethod).toBe('static')
      expect(result.crawledAt).toBeTruthy()
    }
  }, 30000)

  it('respects maxPages limit', async () => {
    const results = await crawl(baseUrl, {
      maxPages: 2,
      respectRobotsTxt: false,
      delayMs: 0,
    })
    expect(results.length).toBeLessThanOrEqual(2)
  }, 30000)

  it('captures correct page titles', async () => {
    const results = await crawl(baseUrl, { respectRobotsTxt: false, delayMs: 0 })
    const titles = results.map((r) => r.title)
    expect(titles).toContain('Home')
    expect(titles).toContain('About Us')
    expect(titles).toContain('Services')
    expect(titles).toContain('Contact')
  }, 30000)

  it('does not visit the same page twice', async () => {
    const results = await crawl(baseUrl, { respectRobotsTxt: false, delayMs: 0 })
    const urls = results.map((r) => r.url)
    const unique = new Set(urls)
    expect(unique.size).toBe(urls.length)
  }, 30000)
})
