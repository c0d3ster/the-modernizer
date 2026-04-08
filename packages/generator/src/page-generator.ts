import type { PageSchema, ContentBlock } from '@modernizer/schema'

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
    const lines = entries.map(([k, v]) => `${pad}${k}: ${serializeValue(v, depth + 1)}`).join(',\n')
    return `{\n${lines},\n${closePad}}`
  }
  return String(value)
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

  const jsx = page.blocks.map(blockToJsx).join('\n')

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
