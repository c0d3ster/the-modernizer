import ts from 'typescript'

const SOURCE_FILE = /\.(tsx?|jsx?|mjs)$/

/**
 * Syntax errors in generated source files, one line each ("src/app/page.tsx:5 Expected ';'").
 * Parse-only (no type checking), so it is fast and needs no project setup. The model occasionally
 * returns a corrupted line inside an otherwise valid file; catching it here lets the call retry
 * instead of shipping a project that will not build.
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
      return diagnostics.map((d) => {
        const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0
        return `${path}:${line} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
      })
    })
