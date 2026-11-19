import { describe, it, expect } from 'vitest'

import { hexIn } from './site-extractor.js'

describe('hexIn', () => {
  it('pulls the hex out of a candidate label the model echoed back', () => {
    expect(hexIn('inline-style (#950E12)')).toBe('#950e12')
    expect(hexIn('#2563eb')).toBe('#2563eb')
    expect(hexIn('#fff')).toBe('#fff')
    expect(hexIn('brand red')).toBeUndefined()
    expect(hexIn(undefined)).toBeUndefined()
  })
})
