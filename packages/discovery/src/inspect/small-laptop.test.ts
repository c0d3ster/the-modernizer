import { describe, expect, it } from 'vitest'

import { smallLaptopIssues } from './small-laptop.js'
import { pageFeatures } from './test-fixtures.js'

const links = (n: number): string[] => Array.from({ length: n }, (_, i) => `Link ${i + 1}`)

describe('smallLaptopIssues', () => {
  it('reports nothing when either view is missing', () => {
    expect(smallLaptopIssues(null, pageFeatures())).toEqual([])
    expect(smallLaptopIssues(pageFeatures(), null)).toEqual([])
  })

  it('reports nothing when the layouts match', () => {
    const view = pageFeatures({ menuLinks: links(7), ctas: [{ text: 'Call now', goesTo: 'starts a phone call' }] })
    expect(smallLaptopIssues(view, view)).toEqual([])
  })

  it('notices a menu that collapses to a menu button', () => {
    expect(smallLaptopIssues(pageFeatures({ menuLinks: links(7) }), pageFeatures({ menuLinks: [], menuButton: true }))).toEqual([
      'Menu collapses to a menu button (7 links down to 0)',
    ])
  })

  it('notices menu links that vanish without a menu button, but not one or two', () => {
    expect(smallLaptopIssues(pageFeatures({ menuLinks: links(8) }), pageFeatures({ menuLinks: links(5) }))).toEqual(['Menu drops from 8 links to 5'])
    expect(smallLaptopIssues(pageFeatures({ menuLinks: links(8) }), pageFeatures({ menuLinks: links(6) }))).toEqual([])
  })

  it('ignores a few pixels of sideways scroll and caps large ones', () => {
    expect(smallLaptopIssues(pageFeatures(), pageFeatures({ overflowPx: 15 }))).toEqual([])
    expect(smallLaptopIssues(pageFeatures(), pageFeatures({ overflowPx: 80 }))).toEqual(['Page scrolls sideways by 80px'])
    expect(smallLaptopIssues(pageFeatures(), pageFeatures({ overflowPx: 600 }))).toEqual(['Page scrolls sideways by 600px or more'])
  })

  it('notices when the main button drops out of the first screen', () => {
    const laptop = pageFeatures({ ctas: [{ text: 'Book Online', goesTo: 'online booking (NexHealth)' }] })
    expect(smallLaptopIssues(laptop, pageFeatures())).toEqual(['Main button "Book Online" is not in the first screen'])
    expect(smallLaptopIssues(laptop, pageFeatures({ ctas: [{ text: 'book online', goesTo: 'online booking (NexHealth)' }] }))).toEqual([])
  })
})
