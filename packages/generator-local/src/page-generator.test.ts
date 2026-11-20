import { describe, expect, it } from 'vitest'

import { sanitizeGenericHtml, titleIframes } from './page-generator.js'

describe('sanitizeGenericHtml heading levels', () => {
  it('lifts a stray h4 so no level is skipped', () => {
    expect(sanitizeGenericHtml('<h4>Our news</h4><h2>In the media</h2><h3>Santa returns</h3><p>Free photos.</p>')).toBe(
      '<h2>Our news</h2>\n<h2>In the media</h2>\n<h3>Santa returns</h3>\n<p>Free photos.</p>'
    )
  })

  it('starts below the section title and never reuses h1', () => {
    expect(sanitizeGenericHtml('<h1>Welcome</h1><h5>Hours</h5>', 3)).toBe('<h3>Welcome</h3>\n<h4>Hours</h4>')
  })
})

describe('titleIframes', () => {
  it('names videos, maps and anything else', () => {
    const html = titleIframes('<iframe id="video-iframe-1" src="about:blank"></iframe><iframe src="https://www.google.com/maps/embed?pb=1"></iframe><iframe src="https://x.test/widget"></iframe>', 'Reviews')
    expect(html).toContain('title="Video"')
    expect(html).toContain('title="Map"')
    expect(html).toContain('title="Reviews"')
  })

  it('keeps an existing title', () => {
    expect(titleIframes('<iframe title="Booking" src="https://x.test"></iframe>', 'Embedded content')).toContain('title="Booking"')
  })
})
