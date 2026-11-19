import { describe, it, expect } from 'vitest'

import { urlToComponentName, urlToRoutePath } from './route-mapper.js'

const base = 'https://www.example.com/'

describe('urlToComponentName', () => {
  it('makes a valid identifier from file-style and underscored paths', () => {
    expect(urlToComponentName('https://www.example.com/contact.html', base)).toBe('ContactHtmlPage')
    expect(urlToComponentName('https://www.example.com/about_us/our-team', base)).toBe('AboutUsOurTeamPage')
    expect(urlToComponentName('https://www.example.com/2024-news', base)).toBe('_2024NewsPage')
    expect(urlToComponentName(base, base)).toBe('HomePage')
  })
})

describe('urlToRoutePath', () => {
  it('keeps the original path so existing links still match', () => {
    expect(urlToRoutePath('https://www.example.com/contact.html', base)).toBe('src/app/contact.html/page.tsx')
  })
})
