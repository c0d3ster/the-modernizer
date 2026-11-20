import { describe, expect, it } from 'vitest'

import { generateIconSvg, generateMetadataExport, monogram, siteOrigin } from './site-shell.js'

const schema = {
  siteName: 'The Correll Firm',
  tagline: 'Injury lawyers in Winchester',
  rootUrl: 'https://web.archive.org/web/2024/https://correllfirm.com/about',
  heroImageUrl: 'https://correllfirm.com/hero.jpg',
}

describe('generateMetadataExport', () => {
  it('adds Open Graph and Twitter tags with the hero photo', () => {
    const code = generateMetadataExport(schema)
    expect(code).toContain('metadataBase: new URL("https://correllfirm.com")')
    expect(code).toContain('openGraph: {')
    expect(code).toContain('images: [{ url: "https://correllfirm.com/hero.jpg"')
    expect(code).toContain("card: 'summary_large_image'")
    expect(code).toContain('description: "Injury lawyers in Winchester"')
  })

  it('falls back to the logo, then to a text-only card', () => {
    expect(generateMetadataExport({ ...schema, heroImageUrl: undefined, logoUrl: 'https://correllfirm.com/logo.png' })).toContain('logo.png')
    const bare = generateMetadataExport({ ...schema, heroImageUrl: '/local.jpg' })
    expect(bare).not.toContain('images:')
    expect(bare).toContain("card: 'summary'")
  })
})

describe('favicon', () => {
  it('uses the first real word of the name', () => {
    expect(monogram('The Correll Firm')).toBe('C')
    expect(monogram('  doppio bunny')).toBe('D')
    expect(monogram('!!!')).toBe('S')
  })

  it('draws the initial in the brand colors and escapes them', () => {
    const svg = generateIconSvg('Brant & Sons', { primary: '#1e3a8a', primaryForeground: '#ffffff' })
    expect(svg).toContain('fill="#1e3a8a"')
    expect(svg).toContain('>B</text>')
  })

  it('reads the origin through a Wayback URL', () => {
    expect(siteOrigin('http://web.archive.org/web/2020id_/http://drbobbyamos.com/')).toBe('http://drbobbyamos.com')
  })
})
