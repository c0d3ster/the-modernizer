// Dev script — runs the generator against a saved SiteSchema fixture.
//
// Usage:
//   pnpm --filter @modernizer/generator generate ../extractor/fixtures/edgehill-schema-v4.json
//   pnpm --filter @modernizer/generator generate ../extractor/fixtures/edgehill-schema-v4.json --out /tmp/my-site

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SiteSchema } from '@modernizer/schema'
import { generateSite } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outPath = outFlag !== -1 ? resolve(args[outFlag + 1]!) : resolve(__dirname, '../../../.generated')
const schemaPath = args.find((a, i) => !a.startsWith('--') && i !== outFlag + 1)

if (!schemaPath) {
  console.error('Usage: pnpm --filter @modernizer/generator generate <schema.json> [--out <dir>]')
  process.exit(1)
}

console.log(`Loading schema: ${schemaPath}`)
const raw = await readFile(resolve(schemaPath), 'utf-8')
const schema: SiteSchema = JSON.parse(raw)
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
