import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '../../ui/src')

// Deterministic shadcn/ui primitives — copied verbatim rather than left to the LLM, since these
// are standardized, non-ambiguous components. Keeps every generated site's Button/Card/etc. correct
// (e.g. Button's asChild -> Slot wiring) instead of re-deriving them from scratch on every run.
const SHADCN_FILES = ['button.tsx', 'badge.tsx', 'card.tsx', 'accordion.tsx', 'avatar.tsx', 'separator.tsx']

export interface CopiedFile {
  path: string
  content: string
}

const rewriteCnImport = (source: string): string => source.replace(/from '\.\.\/lib\/cn'/g, "from '@/lib/utils'")

export const copyDeterministicComponents = async (): Promise<CopiedFile[]> => {
  const shadcnFiles = await Promise.all(
    SHADCN_FILES.map(async (name) => {
      const raw = await readFile(join(UI_SRC, 'shadcn', name), 'utf8')
      return { path: `src/components/ui/${name}`, content: rewriteCnImport(raw) }
    })
  )

  const cnHelper = await readFile(join(UI_SRC, 'lib/cn.ts'), 'utf8')

  return [...shadcnFiles, { path: 'src/lib/utils.ts', content: cnHelper }]
}
