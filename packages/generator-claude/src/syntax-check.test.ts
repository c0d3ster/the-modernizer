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
