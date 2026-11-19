import { describe, it, expect } from 'vitest'

import { splitBlocks } from './block-splitter.js'
import { stripChrome } from './chrome-stripper.js'

const section = (title: string): string =>
  `<div class="row"><div class="col"><div class="inner"><p>${title} has enough words in it to count as a real section of content.</p></div></div></div>`

describe('splitBlocks', () => {
  it('looks through page-builder wrappers that hold one child each', () => {
    const html = `<div class="page"><div class="wrap"><div class="sections">${section('About')}${section('Menu')}${section('Contact')}</div></div></div>`
    expect(splitBlocks(html)).toHaveLength(3)
  })
})

describe('stripChrome', () => {
  it('keeps the content of a one-page site', () => {
    const rawHtml = `<html><body><nav>Home Menu</nav><div class="main">${section('About')}${section('Menu')}</div></body></html>`
    const { contentHtml } = stripChrome([{ url: 'https://example.com/', rawHtml }])
    expect(contentHtml['https://example.com/']).toContain('About has enough words')
    expect(contentHtml['https://example.com/']).not.toContain('<nav>')
  })
})
