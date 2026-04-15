// Dev script — runs the generator against a saved SiteSchema fixture.
//
// Usage:
//   pnpm --filter @modernizer/generator generate
//   pnpm --filter @modernizer/generator generate --schema packages/extractor/fixtures/edgehill-schema-v5.json
//   pnpm --filter @modernizer/generator generate --schema <path> --out <dir>

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSchemaSchema } from '@modernizer/schema'
import { generateSite } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

const args = process.argv.slice(2)

const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

const schemaArg = flag('--schema')
const outArg = flag('--out')
const outPath = outArg ? resolve(repoRoot, outArg) : resolve(repoRoot, '.generated')

const defaultSchema = resolve(repoRoot, 'packages/extractor/fixtures/edgehill-schema-v5.json')
const schemaPath = schemaArg ? resolve(repoRoot, schemaArg) : defaultSchema
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
