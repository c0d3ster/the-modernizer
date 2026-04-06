import * as cheerio from 'cheerio'

const MIN_BLOCKS = 1
const MAX_BLOCKS = 15
const SPLIT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'hr', 'section', 'article'])

export interface RawBlock {
  html: string
  headingText?: string
}

const hasSubstantialText = (html: string): boolean => {
  const $ = cheerio.load(html)
  return $('body').text().replace(/\s+/g, ' ').trim().length > 30
}

export const splitBlocks = (contentHtml: string): RawBlock[] => {
  const $ = cheerio.load(contentHtml)
  const blocks: RawBlock[] = []
  let current: string[] = []

  const flushCurrent = (): void => {
    const html = current.join('\n').trim()
    if (html && hasSubstantialText(html)) {
      blocks.push({ html })
    }
    current = []
  }

  $('body').children().each((_, el) => {
    const tag = ('tagName' in el ? el.tagName : '').toLowerCase()

    if (SPLIT_TAGS.has(tag)) {
      flushCurrent()
      const elHtml = $.html(el) ?? ''
      const headingText = ['h1', 'h2', 'h3', 'h4'].includes(tag)
        ? $(el).text().trim()
        : undefined

      // start next block with this heading as context
      if (headingText) {
        current.push(elHtml)
      } else {
        // hr or section boundary — flush as its own block if it has content
        if (tag === 'section' || tag === 'article') {
          const inner = $(el).html() ?? ''
          if (hasSubstantialText(inner)) {
            blocks.push({ html: inner })
          }
        }
      }
    } else {
      current.push($.html(el) ?? '')
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
