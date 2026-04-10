// Dev script — runs the generator against a saved SiteSchema fixture.
//
// Usage:
//   pnpm --filter @modernizer/generator generate --schema ../extractor/fixtures/site-schema.json
//   pnpm --filter @modernizer/generator generate --schema C:/path/to/schema.json --out C:/path/to/output

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSchemaSchema } from '@modernizer/schema'
import { generateSite } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)

const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

const schemaArg = flag('--schema')
const outArg = flag('--out')
const outPath = outArg ? resolve(outArg) : resolve(__dirname, '../../../.generated')

if (!schemaArg) {
  console.error('Usage: pnpm --filter @modernizer/generator generate --schema <schema.json> [--out <dir>]')
  process.exit(1)
}

const schemaPath = resolve(schemaArg)
console.log(`Loading schema: ${schemaPath}`)
const raw = await readFile(schemaPath, 'utf-8')
const parsed: unknown = JSON.parse(raw)
const schema = siteSchemaSchema.parse(parsed)
console.log(`  Site: ${schema.siteName}`)
console.log(`  Pages: ${schema.pages.length}`)
console.log(`  Output: ${outPath}\n`)

console.log('Generating...')
await generateSite(schema, outPath)

console.log('Done.\n')
console.log('To run the generated site:')
console.log(`  cd ${outPath}`)
console.log('  npm install')
console.log('  npm run dev')
