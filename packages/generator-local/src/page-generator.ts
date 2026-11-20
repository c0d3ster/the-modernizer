import * as cheerio from 'cheerio'
import type { PageSchema, ContentBlock } from '@modernizer/schema'
import type { GenericSectionBlock } from '@modernizer/schema'

// Most block types follow the convention: snake_case -> PascalCaseBlock
// These three deviate from it
const COMPONENT_EXCEPTIONS: Record<string, string> = {
  cta: 'CTABlock',
  faq: 'FAQBlock',
  generic_section: 'GenericSection',
}

const blockTypeToComponent = (type: string): string => {
  if (type in COMPONENT_EXCEPTIONS) return COMPONENT_EXCEPTIONS[type]!
  return type.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Block'
}

const isValidJsIdentifierKey = (k: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)

// Serializes a JS value as single-quoted object literal for code generation
const serializeValue = (value: unknown, depth = 0): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '')
    return `'${escaped}'`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const pad = '  '.repeat(depth + 1)
    const closePad = '  '.repeat(depth)
    const items = value.map((v) => `${pad}${serializeValue(v, depth + 1)}`).join(',\n')
    return `[\n${items},\n${closePad}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const pad = '  '.repeat(depth + 1)
    const closePad = '  '.repeat(depth)
    const lines = entries
      .map(([k, v]) => `${pad}${isValidJsIdentifierKey(k) ? k : JSON.stringify(k)}: ${serializeValue(v, depth + 1)}`)
      .join(',\n')
    return `{\n${lines},\n${closePad}}`
  }
  return String(value)
}

// Strips plugin/widget markup from generic_section rawHtml down to readable
// headings and paragraphs. Removes script/style tags, shortcodes, and elements
// that have no text content after inner HTML is discarded.
// Headings in extracted HTML keep the old site's levels (an <h4> straight under the page's <h1>),
// which screen readers and Lighthouse read as a skipped level. Each heading is placed at most one
// level below the previous one, starting at `topLevel` (h2, or h3 under the section's own title).
export const sanitizeGenericHtml = (rawHtml: string, topLevel = 2): string => {
  const $ = cheerio.load(rawHtml)

  // Remove scripts, styles, and WordPress shortcodes
  $('script, style, noscript').remove()

  // Extract headings and paragraphs with non-empty text
  const parts: string[] = []
  let previous = topLevel - 1
  $('h1, h2, h3, h4, h5, h6, p').each((_, el) => {
    const text = $(el).text().trim()
    // Skip empty, shortcode-only, or very short noise
    if (!text || text.startsWith('[') || text.length < 3) return
    const tag = (el as unknown as { name: string }).name
    if (tag === 'p') {
      parts.push(`<p>${text}</p>`)
      return
    }
    const level = Math.min(Math.max(Number(tag.slice(1)), topLevel), previous + 1, 6)
    previous = level
    parts.push(`<h${level}>${text}</h${level}>`)
  })

  return parts.join('\n')
}

const iframeTitle = (src: string, id: string, fallback: string): string => {
  const hint = `${src} ${id}`.toLowerCase()
  if (/youtube|vimeo|wistia|video/.test(hint)) return 'Video'
  if (/maps|map/.test(hint)) return 'Map'
  return fallback
}

/** Every iframe gets a title so screen readers can say what it is (embeds from old sites rarely have one). */
export const titleIframes = (html: string, fallback: string): string => {
  const $ = cheerio.load(html, null, false)
  $('iframe').each((_, el) => {
    const frame = $(el)
    if (frame.attr('title')?.trim()) return
    frame.attr('title', iframeTitle(frame.attr('src') ?? '', frame.attr('id') ?? '', fallback))
  })
  return $.html()
}

const sanitizeBlock = (block: ContentBlock): ContentBlock => {
  if (block.type === 'embed') return { ...block, embedHtml: titleIframes(block.embedHtml, block.heading ?? 'Embedded content') }
  if (block.type !== 'generic_section') return block
  const b = block as GenericSectionBlock
  return { ...b, rawHtml: sanitizeGenericHtml(b.rawHtml, b.heading ? 3 : 2) }
}

// Blocks that own their own background (primary, black, etc.) — excluded from alternating rhythm
const SELF_COLORED_BLOCKS = new Set(['hero', 'cta', 'stats'])

/** How full-size heroes render: the vertical's hero variant, plus an optional second action (e.g. call). */
export interface HeroStyle {
  variant: 'overlay' | 'panel' | 'centered'
  secondaryCta?: { text: string; url: string }
}

const heroProps = (block: ContentBlock, hero: HeroStyle | undefined): string => {
  if (!hero || block.type !== 'hero' || block.compact) return ''
  const secondary = hero.secondaryCta && hero.secondaryCta.url !== block.ctaUrl ? ` secondaryCta={${serializeValue(hero.secondaryCta, 2)}}` : ''
  return ` variant='${hero.variant}'${secondary}`
}

const blockToJsx = (block: ContentBlock, alt: boolean, hero?: HeroStyle): string => {
  const component = blockTypeToComponent(block.type)
  const blockLine = `<${component} block={${serializeValue(block, 2)}}${heroProps(block, hero)} />`
  const baseIndent = '      '
  if (!alt) return `${baseIndent}${blockLine}`
  return `${baseIndent}<div className="bg-muted/40">\n${baseIndent}  ${blockLine}\n${baseIndent}</div>`
}

export const generatePage = (page: PageSchema, componentName: string, hero?: HeroStyle): string => {
  // Dedupe imports by component name
  const components = [...new Set(page.blocks.map((b) => blockTypeToComponent(b.type)))]
  const imports = components
    .map((c) => `import { ${c} } from '@/components/blocks/${c}'`)
    .join('\n')

  // Alternate muted backgrounds on plain content blocks for visual rhythm.
  // Self-colored blocks (hero, cta, stats) break the sequence and reset the counter.
  let altCounter = 0
  const jsx = page.blocks.map(sanitizeBlock).map((block) => {
    if (SELF_COLORED_BLOCKS.has(block.type)) { altCounter = 0; return blockToJsx(block, false, hero) }
    return blockToJsx(block, altCounter++ % 2 === 1, hero)
  }).join('\n')

  return `import type { ReactElement } from 'react'
${imports}

const ${componentName} = (): ReactElement => {
  return (
    <main>
${jsx}
    </main>
  )
}

export default ${componentName}
`
}
