import { describe, expect, it } from 'vitest'

import { contrastRatio, ensureContrast, parseHex, readableOn, TEXT_CONTRAST } from './contrast.js'
import { generateGlobalsCss } from './config-generator.js'

const themeValue = (css: string, name: string): string => css.match(new RegExp(`--color-${name}: (#[0-9a-f]+);`, 'i'))?.[1] ?? ''

describe('contrast', () => {
  it('measures black on white as 21:1', () => {
    expect(contrastRatio('#000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('ignores colors it cannot parse', () => {
    expect(parseHex('rgb(0 0 0)')).toBeNull()
    expect(ensureContrast('oklch(0.7 0.1 80)', ['#ffffff'])).toBe('oklch(0.7 0.1 80)')
  })

  it('deepens a pale brand color only as far as needed', () => {
    const fixed = ensureContrast('#f8b038', ['#fffdf9', '#f5e7d1'])
    expect(contrastRatio(fixed, '#fffdf9')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(contrastRatio(fixed, '#f5e7d1')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(contrastRatio(fixed, '#fffdf9')).toBeLessThan(5.5)
  })

  it('leaves a color that already passes alone', () => {
    expect(ensureContrast('#1e3a8a', ['#ffffff'])).toBe('#1e3a8a')
  })

  it('picks readable text for a fill', () => {
    expect(readableOn('#f8b038', ['#ffffff', '#1c1917'])).toBe('#1c1917')
    expect(readableOn('#1e3a8a', ['#ffffff', '#1c1917'])).toBe('#ffffff')
  })
})

describe('generateGlobalsCss contrast', () => {
  it('never puts white text on a yellow button', () => {
    const css = generateGlobalsCss({ primary: '#f8b038', text: '#ffffff' })
    const primary = themeValue(css, 'primary')
    expect(contrastRatio(themeValue(css, 'primary-foreground'), primary)).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(contrastRatio(primary, themeValue(css, 'background'))).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })

  it('nudges a nearly passing blue over the line on a beige page', () => {
    const css = generateGlobalsCss({ primary: '#3068c0', background: '#ebe8e1' })
    expect(contrastRatio(themeValue(css, 'primary'), '#ebe8e1')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })
})
