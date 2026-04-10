import * as cheerio from 'cheerio'

const MIN_BLOCKS = 1
const MAX_BLOCKS = 15
const SPLIT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'hr', 'section', 'article'])

// known WordPress/generic wrapper IDs and classes that contain content but are not content themselves
const WRAPPER_SELECTORS = [
  '#wrap', '#wrapper', '#page', '#container', '#main-wrapper', '#outer-wrapper',
  '#content-wrapper', '#site', '#site-wrapper', '#body-wrapper', '#inner',
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
  '#inner',
]

// Elements within the body that are chrome, not content
const RESIDUAL_CHROME_SELECTOR = [
  'nav', 'header', 'footer',
  '#header', '#footer', '#nav', '#navbar',
  '#navigation', '#main-navigation',
  '.main-navigation', '.nav-menu',
  '.site-header', '.site-footer',
  '.widget-area', '.sidebar', '#sidebar',
].join(', ')

export interface RawBlock {
  html: string
  headingText?: string
}

const hasSubstantialText = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('body').text().replace(/\s+/g, ' ').trim().length > 30
}

const stripResidualChrome = ($: cheerio.CheerioAPI): void => {
  $(RESIDUAL_CHROME_SELECTOR).remove()
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
      const classTokens = (child.attr('class') ?? '').split(/\s+/).filter(Boolean)
      const matchesSelector = (s: string): boolean => {
        if (s.startsWith('#')) return s === `#${id}`
        if (s.startsWith('.')) return classTokens.includes(s.slice(1))
        return false
      }
      const isWrapper =
        tag === 'div' &&
        (WRAPPER_SELECTORS.some(matchesSelector) ||
          id.includes('wrap') || id.includes('container') || id.includes('page'))
      if (isWrapper) {
        root = child
        unwrapped = true
      }
    }
  }

  return root
}

// Collect blocks from an element, recursing into substantial divs that
// themselves contain multiple substantial children (e.g. WordPress widget columns).
const collectBlocks = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, blocks: RawBlock[]): void => {
  const current: string[] = []

  const flushCurrent = (): void => {
    const html = current.join('\n').trim()
    if (html && hasSubstantialText(html)) {
      blocks.push({ html })
    }
    current.length = 0
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
      // Check whether this div is itself a multi-section container (e.g. a
      // widget column or page-builder row). If it has multiple substantial
      // child divs, recurse rather than treating it as one opaque block.
      const substantialChildren = $(el).children('div').filter((_, child) =>
        hasSubstantialText($.html(child) ?? '')
      )

      if (substantialChildren.length >= 2) {
        flushCurrent()
        collectBlocks($, $(el), blocks)
      } else {
        flushCurrent()
        blocks.push({ html: elHtml })
      }
    } else {
      current.push(elHtml)
    }
  })

  flushCurrent()
}

export const splitBlocks = (contentHtml: string): RawBlock[] => {
  const $ = cheerio.load(contentHtml)

  stripResidualChrome($)

  const root = getContentRoot($)
  const blocks: RawBlock[] = []

  collectBlocks($, root, blocks)

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
