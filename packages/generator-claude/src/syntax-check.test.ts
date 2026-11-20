import { describe, expect, it } from 'vitest'

import { syntaxErrors } from './syntax-check.js'

describe('syntaxErrors', () => {
  it('passes valid TSX', () => {
    const content = "import { Button } from '@/components/ui/button'\n\nconst Page = (): React.ReactElement => <Button>Hi</Button>\n\nexport default Page\n"
    expect(syntaxErrors([{ path: 'src/app/page.tsx', content }])).toEqual([])
  })

  it('catches the corrupted import line seen in a generated page', () => {
    const content = 'import { Card } from "@/components/ui/card";\niment-Wrench: true\nimport { Phone } from "lucide-react";\n'
    const [error] = syntaxErrors([{ path: 'src/app/services/page.tsx', content }])
    expect(error).toMatch(/^src\/app\/services\/page\.tsx:2 /)
  })

  it('skips files that are not source code', () => {
    expect(syntaxErrors([{ path: '__design-system.json', content: '{ not code' }])).toEqual([])
  })
})

describe('syntaxErrors corruption that still parses', () => {
  it('flags a stray word, a dashed component tag and an empty page', () => {
    const page = `import { Card } from '@/components/ui/card'\nimom\n\nexport default function Page() {\n  return null\n}\n`
    expect(syntaxErrors([{ path: 'src/app/x/page.tsx', content: page }])).toEqual([
      'src/app/x/page.tsx:2 stray word "imom" on its own line',
      'src/app/x/page.tsx:4 the page component renders nothing (an empty element or null)',
    ])
    const tag = `export default function Page() {\n  return (\n    <main>\n      <Separator-section />\n    </main>\n  )\n}\n`
    expect(syntaxErrors([{ path: 'src/app/page.tsx', content: tag }])).toEqual(['src/app/page.tsx:4 invalid component tag <Separator-section>'])
  })

  it('flags a page that returns an empty element or fragment', () => {
    for (const body of ['<div />', '(\n    <>\n    </>\n  )', '<main></main>']) {
      const page = `const items = [1, 2]\n\nexport default function HomePage() {\n  return ${body}\n}\n`
      expect(syntaxErrors([{ path: 'src/app/page.tsx', content: page }])).toEqual(['src/app/page.tsx:3 the page component renders nothing (an empty element or null)'])
    }
  })

  it('leaves normal components alone', () => {
    const ok = `'use client'\nexport default function Page() {\n  return <section><Separator /><my-widget /></section>\n}\n`
    expect(syntaxErrors([{ path: 'src/app/page.tsx', content: ok }])).toEqual([])
  })
})
