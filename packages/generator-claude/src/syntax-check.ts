import ts from 'typescript'

const SOURCE_FILE = /\.(tsx?|jsx?|mjs)$/
const PAGE_FILE = /(^|\/)page\.(tsx|jsx)$/

const lineOf = (source: ts.SourceFile, node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

const returnsOnlyNull = (body: ts.Block | undefined): boolean => {
  const [only, ...rest] = body?.statements ?? []
  return rest.length === 0 && only !== undefined && ts.isReturnStatement(only) && only.expression?.kind === ts.SyntaxKind.NullKeyword
}

/**
 * Corruption that still parses: a stray word left on its own line ("imom"), a component tag with
 * a dash glued on ("<Separator-section />"), or a page that renders nothing. Seen in real output;
 * each one fails the build or ships an empty page.
 */
const corruption = (path: string, content: string): string[] => {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.ES2022, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const errors: string[] = []
  for (const statement of source.statements) {
    if (ts.isExpressionStatement(statement) && ts.isIdentifier(statement.expression)) {
      errors.push(`${path}:${lineOf(source, statement)} stray word "${statement.expression.text}" on its own line`)
    }
    if (PAGE_FILE.test(path) && ts.isFunctionDeclaration(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && returnsOnlyNull(statement.body)) {
      errors.push(`${path}:${lineOf(source, statement)} the page component renders nothing (returns null)`)
    }
  }
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[A-Z][\w]*-/.test(node.tagName.getText(source))) {
      errors.push(`${path}:${lineOf(source, node)} invalid component tag <${node.tagName.getText(source)}>`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}

/**
 * Problems in generated source files, one line each ("src/app/page.tsx:5 Expected ';'"): syntax
 * errors plus corruption that parses but cannot work. Parse-only (no type checking), so it is fast
 * and needs no project setup. The model occasionally returns a corrupted line inside an otherwise
 * valid file; catching it here lets the call retry instead of shipping a project that will not build.
 */
export const syntaxErrors = (files: readonly { path: string; content: string }[]): string[] =>
  files
    .filter((f) => SOURCE_FILE.test(f.path))
    .flatMap(({ path, content }) => {
      const { diagnostics = [] } = ts.transpileModule(content, {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      })
      const syntax = diagnostics.map((d) => {
        const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0
        return `${path}:${line} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
      })
      return syntax.length > 0 ? syntax : corruption(path, content)
    })
