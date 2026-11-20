import { describe, expect, it } from 'vitest'

import { computeStaticV2, latestCopyrightYear } from './static-v2.js'

const now = new Date('2026-11-20T12:00:00Z')

describe('latestCopyrightYear', () => {
  it('reads symbols, entities, words and ranges', () => {
    expect(latestCopyrightYear('<footer>© 2019 Brant Plumbing</footer>')).toBe(2019)
    expect(latestCopyrightYear('<p>&copy; 2015 - 2023 Mangia</p>')).toBe(2023)
    expect(latestCopyrightYear('<p>Copyright 2021. All rights reserved</p><p>© 2017</p>')).toBe(2021)
    expect(latestCopyrightYear('<p>Since 1989</p>')).toBeNull()
  })
})

describe('computeStaticV2', () => {
  it('gives a current, responsive, cleanly styled page 100', () => {
    const html = '<img srcset="a.jpg 1x, b.jpg 2x" src="a.jpg"><footer>© 2026 Shop</footer>'
    expect(computeStaticV2({ html, now })).toEqual({ score: 100, copyrightYearsBehind: 0, noSrcset: false, inlineStyles: 0 })
  })

  it('deducts for a stale year, no srcset and heavy inline styling', () => {
    const styled = '<div style="color:red"></div>'.repeat(75)
    const result = computeStaticV2({ html: `<img src="a.jpg">${styled}<footer>© 2017</footer>`, now })
    expect(result.copyrightYearsBehind).toBe(9)
    expect(result.score).toBe(100 - 40 - 30 - 15)
  })

  it('counts a missing copyright line as one year behind', () => {
    expect(computeStaticV2({ html: '<picture><source srcset="a.webp"></picture>', now }).score).toBe(90)
  })
})
