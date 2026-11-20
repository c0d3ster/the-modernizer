import { describe, expect, it } from 'vitest'
import { VERTICAL_PROFILES } from '@modernizer/design-guide'

import { generateGlobalsCss } from './config-generator.js'

describe('generateGlobalsCss', () => {
  it('keeps the default look when no theme is given', () => {
    const css = generateGlobalsCss({ primary: '#115e59' })
    expect(css).toContain('--color-primary: #115e59;')
    expect(css).toContain('--color-background: #f4f1ec;')
    expect(css).toContain('text-transform: none;')
  })

  it('applies the vertical theme: neutrals, heading style and radii', () => {
    const css = generateGlobalsCss({ primary: '#0f766e' }, VERTICAL_PROFILES['home-services'].theme)
    expect(css).toContain('--color-background: #f6f7f9;')
    expect(css).toContain('--radius-button: 0.375rem;')
    expect(css).toContain('text-transform: uppercase;')
  })

  it("lets the site's own background win over the theme", () => {
    const css = generateGlobalsCss({ primary: '#0f766e', background: '#101010' }, VERTICAL_PROFILES.restaurant.theme)
    expect(css).toContain('--color-background: #101010;')
  })

  it('drops unsafe theme values', () => {
    const theme = { ...VERTICAL_PROFILES.general.theme, buttonRadius: '1rem; } body { display: none', muted: 'url(x)' }
    const css = generateGlobalsCss({ primary: '#0f766e' }, theme)
    expect(css).toContain('--radius-button: 0.375rem;')
    expect(css).toContain('--color-muted: #e8e5e0;')
  })
})
