import * as cheerio from 'cheerio'

const MIN_BLOCKS = 1
const MAX_BLOCKS = 15
const SPLIT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'hr', 'section', 'article'])

// known WordPress/generic wrapper IDs and classes that contain content but are not content themselves
const WRAPPER_SELECTORS = [
  '#wrap', '#wrapper', '#page', '#container', '#main-wrapper', '#outer-wrapper',
  '#content-wrapper', '#site', '#site-wrapper', '#body-wrapper',
]

// preferred content area selectors — try these before falling back to body children
const CONTENT_SELECTORS = [
  'main',
  '[role="main"]',
  '#content',
  '#main',
  '#primary',
  '.main-content',
  '.entry-content',
  '.post-content',
  '.page-content',
  '.content-area',
]

export interface RawBlock {
  html: string
  headingText?: string
}

const hasSubstantialText = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('body').text().replace(/\s+/g, ' ').trim().length > 30
}

// strip leftover chrome elements that should have been removed earlier
const stripResidualChrome = ($: cheerio.CheerioAPI): void => {
  $('nav, header, footer, #header, #footer, #navbar, #navigation, #main-navigation, .main-navigation, .nav-menu, .site-header, .site-footer, .widget-area, .sidebar, #sidebar').remove()
}

const getContentRoot = ($: cheerio.CheerioAPI): ReturnType<cheerio.CheerioAPI> => {
  // 1. try known content selectors first
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector)
    if (el.length > 0 && hasSubstantialText(el.html() ?? '')) {
      return el
    }
  }

  // 2. unwrap known generic wrapper divs iteratively
  let root = $('body')
  let unwrapped = true
  while (unwrapped) {
    unwrapped = false
    const children = root.children()
    if (children.length === 1) {
      const child = children.first()
      const tag = (child.prop('tagName') ?? '').toLowerCase()
      const id = child.attr('id') ?? ''
      const cls = child.attr('class') ?? ''
      const isWrapper =
        tag === 'div' &&
        (WRAPPER_SELECTORS.some((s) => s === `#${id}` || s === `.${cls}`) ||
          id.includes('wrap') || id.includes('container') || id.includes('page'))
      if (isWrapper) {
        root = child
        unwrapped = true
      }
    }
  }

  return root
}

export const splitBlocks = (contentHtml: string): RawBlock[] => {
  const $ = cheerio.load(contentHtml)

  stripResidualChrome($)

  const root = getContentRoot($)
  const blocks: RawBlock[] = []
  let current: string[] = []

  const flushCurrent = (): void => {
    const html = current.join('\n').trim()
    if (html && hasSubstantialText(html)) {
      blocks.push({ html })
    }
    current = []
  }

  root.children().each((_, el) => {
    const tag = ('tagName' in el ? el.tagName : '').toLowerCase()
    const elHtml = $.html(el) ?? ''

    if (SPLIT_TAGS.has(tag)) {
      flushCurrent()
      const headingText = ['h1', 'h2', 'h3', 'h4'].includes(tag)
        ? $(el).text().trim()
        : undefined

      if (headingText) {
        current.push(elHtml)
      } else {
        // section/article/hr — push inner content as its own block
        const inner = $(el).html() ?? ''
        if (hasSubstantialText(inner)) {
          blocks.push({ html: inner })
        }
      }
    } else if (tag === 'div' && hasSubstantialText(elHtml)) {
      // substantial top-level div (e.g. page builder row) — treat as a section boundary
      flushCurrent()
      blocks.push({ html: elHtml })
    } else {
      current.push(elHtml)
    }
  })

  flushCurrent()

  // merge down to MAX_BLOCKS by combining adjacent blocks without headings
  while (blocks.length > MAX_BLOCKS) {
    let merged = false
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i]
      const b = blocks[i + 1]
      if (a && b && !b.headingText) {
        blocks.splice(i, 2, { html: a.html + '\n' + b.html, headingText: a.headingText })
        merged = true
        break
      }
    }
    if (!merged) break
  }

  return blocks.length >= MIN_BLOCKS ? blocks : []
}
