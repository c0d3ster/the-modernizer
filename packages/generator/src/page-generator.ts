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
const sanitizeGenericHtml = (rawHtml: string): string => {
  const $ = cheerio.load(rawHtml)

  // Remove scripts, styles, and WordPress shortcodes
  $('script, style, noscript').remove()

  // Extract headings and paragraphs with non-empty text
  const parts: string[] = []
  $('h1, h2, h3, h4, h5, h6, p').each((_, el) => {
    const text = $(el).text().trim()
    // Skip empty, shortcode-only, or very short noise
    if (!text || text.startsWith('[') || text.length < 3) return
    const tag = (el as unknown as { name: string }).name
    parts.push(`<${tag}>${text}</${tag}>`)
  })

  return parts.join('\n')
}

const sanitizeBlock = (block: ContentBlock): ContentBlock => {
  if (block.type !== 'generic_section') return block
  const b = block as GenericSectionBlock
  return { ...b, rawHtml: sanitizeGenericHtml(b.rawHtml) }
}

const blockToJsx = (block: ContentBlock): string => {
  const component = blockTypeToComponent(block.type)
  return `      <${component} block={${serializeValue(block, 2)}} />`
}

export const generatePage = (page: PageSchema, componentName: string): string => {
  // Dedupe imports by component name
  const components = [...new Set(page.blocks.map((b) => blockTypeToComponent(b.type)))]
  const imports = components
    .map((c) => `import { ${c} } from '@/components/blocks/${c}'`)
    .join('\n')

  const jsx = page.blocks.map(sanitizeBlock).map(blockToJsx).join('\n')

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
