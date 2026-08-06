import { describe, expect, it } from 'vitest'

import {
  detectIeCompatible,
  detectNoOgTags,
  detectNoViewport,
  detectOldJquery,
  detectOldWpTheme,
  detectTableLayout,
  extractOldWpTheme,
} from './signals.js'

describe('detectNoViewport', () => {
  it('fires when no viewport meta tag is present', () => {
    expect(detectNoViewport('<html><head></head><body></body></html>')).toBe(true)
  })

  it('does not fire when a viewport meta tag is present', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>'
    expect(detectNoViewport(html)).toBe(false)
  })
})

describe('detectOldJquery', () => {
  it('fires for jquery 1.x', () => {
    expect(detectOldJquery('<script src="/js/jquery-1.12.4.min.js"></script>')).toBe(true)
  })

  it('fires for jquery 2.x', () => {
    expect(detectOldJquery('<script src="/js/jquery-2.2.4.min.js"></script>')).toBe(true)
  })

  it('does not fire for jquery 3.x', () => {
    expect(detectOldJquery('<script src="/js/jquery-3.7.1.min.js"></script>')).toBe(false)
  })

  it('does not fire when no jquery script is present', () => {
    expect(detectOldJquery('<script src="/js/app.js"></script>')).toBe(false)
  })
})

describe('detectOldWpTheme / extractOldWpTheme', () => {
  it('fires and extracts the theme name for an old default WP theme', () => {
    const html = '<link rel="stylesheet" href="/wp-content/themes/twentyfifteen/style.css">'
    expect(detectOldWpTheme(html)).toBe(true)
    expect(extractOldWpTheme(html)).toBe('twentyfifteen')
  })

  it('does not fire for a custom theme', () => {
    const html = '<link rel="stylesheet" href="/wp-content/themes/my-custom-theme/style.css">'
    expect(detectOldWpTheme(html)).toBe(false)
    expect(extractOldWpTheme(html)).toBeNull()
  })

  it('does not fire when there is no WordPress theme reference at all', () => {
    expect(detectOldWpTheme('<html><body>No WP here</body></html>')).toBe(false)
  })
})

describe('detectNoOgTags', () => {
  it('fires when no Open Graph tags are present', () => {
    expect(detectNoOgTags('<html><head></head></html>')).toBe(true)
  })

  it('does not fire when at least one Open Graph tag is present', () => {
    expect(detectNoOgTags('<meta property="og:title" content="Test">')).toBe(false)
  })
})

describe('detectTableLayout', () => {
  it('fires for a table with no header cells, thead, or table role', () => {
    const html = '<table><tr><td>Home</td><td>About</td></tr></table>'
    expect(detectTableLayout(html)).toBe(true)
  })

  it('does not fire for a data table with th cells', () => {
    const html = '<table><tr><th>Name</th></tr><tr><td>Value</td></tr></table>'
    expect(detectTableLayout(html)).toBe(false)
  })

  it('does not fire for a data table with thead', () => {
    const html = '<table><thead><tr><td>Name</td></tr></thead></table>'
    expect(detectTableLayout(html)).toBe(false)
  })

  it('does not fire for a table with an explicit table role', () => {
    const html = '<table role="table"><tr><td>Name</td></tr></table>'
    expect(detectTableLayout(html)).toBe(false)
  })

  it('does not fire when there are no tables at all', () => {
    expect(detectTableLayout('<div>No tables</div>')).toBe(false)
  })
})

describe('detectIeCompatible', () => {
  it('fires when the X-UA-Compatible meta tag is present', () => {
    const html = '<meta http-equiv="X-UA-Compatible" content="IE=edge">'
    expect(detectIeCompatible(html)).toBe(true)
  })

  it('does not fire when the tag is absent', () => {
    expect(detectIeCompatible('<html><head></head></html>')).toBe(false)
  })
})
