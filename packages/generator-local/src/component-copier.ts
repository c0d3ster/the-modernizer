import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '../../ui/src')
const SCHEMA_SRC = join(dirname(fileURLToPath(import.meta.url)), '../../schema/src')

// Rewrites monorepo-relative imports to @/ aliases for the output project
const IMPORT_REWRITES: Array<[RegExp, string]> = [
  [/from '@modernizer\/schema'/g, "from '@/types/schema'"],
  [/from '\.\.\/shadcn\//g, "from '@/components/shadcn/"],
  [/from '\.\.\/lib\/cn'/g, "from '@/lib/cn'"],
  [/from '\.\.\/styles\/tokens'/g, "from '@/styles/tokens'"],
]

const rewriteImports = (source: string): string =>
  IMPORT_REWRITES.reduce((src, [pattern, replacement]) => src.replace(pattern, replacement), source)

const copyDir = async (srcDir: string, destDir: string, transform = true): Promise<void> => {
  const entries = await readdir(srcDir, { withFileTypes: true })
  await mkdir(destDir, { recursive: true })
  await Promise.all(
    entries
      .filter((e) => e.isFile())
      .map(async (entry) => {
        const content = await readFile(join(srcDir, entry.name), 'utf8')
        await writeFile(join(destDir, entry.name), transform ? rewriteImports(content) : content, 'utf8')
      })
  )
}

// Schema source files to copy into src/types/schema/ (exclude test and validation files)
const SCHEMA_FILES = ['blocks.ts', 'page.ts', 'site.ts', 'index.ts']

const copySchemaTypes = async (outputDir: string): Promise<void> => {
  const destDir = join(outputDir, 'src/types/schema')
  await mkdir(destDir, { recursive: true })
  await Promise.all(
    SCHEMA_FILES.map(async (file) => {
      const content = await readFile(join(SCHEMA_SRC, file), 'utf8')
      // Rewrite .js extension imports used in the schema package to extensionless
      const cleaned = content.replace(/from '\.\/(\w+)\.js'/g, "from './$1'")
      await writeFile(join(destDir, file), cleaned, 'utf8')
    })
  )
}

export const copyComponents = async (outputDir: string): Promise<void> => {
  await Promise.all([
    copyDir(join(UI_SRC, 'shadcn'), join(outputDir, 'src/components/shadcn')),
    copyDir(join(UI_SRC, 'blocks'), join(outputDir, 'src/components/blocks')),
    copyDir(join(UI_SRC, 'layout'), join(outputDir, 'src/components/layout')),
    copyDir(join(UI_SRC, 'lib'), join(outputDir, 'src/lib'), false),
    copyDir(join(UI_SRC, 'styles'), join(outputDir, 'src/styles'), false),
    copySchemaTypes(outputDir),
  ])
}
