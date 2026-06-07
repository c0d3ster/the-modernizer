import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { exec } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport, type SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientMetadata, OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { SiteSchema } from '@modernizer/schema'

const CONFIG_DIR = join(homedir(), '.config', 'the-modernizer')
const AUTH_FILE = join(CONFIG_DIR, 'lovable-auth.json')
const CALLBACK_PORT = 3742
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`

const LOVABLE_MCP_URL = process.env.LOVABLE_MCP_URL ?? 'https://mcp.lovable.dev/sse'

type AuthStore = {
  tokens?: OAuthTokens
  clientInfo?: OAuthClientInformationMixed
  codeVerifier?: string
}

const readAuthStore = async (): Promise<AuthStore> => {
  try {
    const raw = await readFile(AUTH_FILE, 'utf-8')
    return JSON.parse(raw) as AuthStore
  } catch {
    return {}
  }
}

const writeAuthStore = async (store: AuthStore): Promise<void> => {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(AUTH_FILE, JSON.stringify(store, null, 2))
}

const openBrowser = (url: string): void => {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd)
}

const waitForOAuthCallback = (): { promise: Promise<string>; cleanup: () => void } => {
  let resolve!: (code: string) => void
  let reject!: (err: Error) => void
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`)
    const code = url.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><p>Authorization complete. You can close this tab.</p></body></html>')
    server.close()
    if (code) resolve(code)
    else reject(new Error('No authorization code in callback'))
  })

  server.listen(CALLBACK_PORT)
  server.on('error', (err) => reject(err))

  return {
    promise,
    cleanup: () => { try { server.close() } catch { /* ignore */ } },
  }
}

class LovableAuthProvider implements OAuthClientProvider {
  private _pendingCode: Promise<string> | null = null
  private _cleanupCallback: (() => void) | null = null

  get redirectUrl(): string { return CALLBACK_URL }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'the-modernizer',
      redirect_uris: [CALLBACK_URL],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const store = await readAuthStore()
    return store.clientInfo
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    const store = await readAuthStore()
    await writeAuthStore({ ...store, clientInfo: info })
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const store = await readAuthStore()
    return store.tokens
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const store = await readAuthStore()
    await writeAuthStore({ ...store, tokens })
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const { promise, cleanup } = waitForOAuthCallback()
    this._pendingCode = promise
    this._cleanupCallback = cleanup
    process.stdout.write(`\nOpening Lovable authorization in your browser...\n`)
    process.stdout.write(`If it doesn't open, visit:\n  ${authorizationUrl.toString()}\n\n`)
    openBrowser(authorizationUrl.toString())
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    const store = await readAuthStore()
    await writeAuthStore({ ...store, codeVerifier: verifier })
  }

  async codeVerifier(): Promise<string> {
    const store = await readAuthStore()
    if (!store.codeVerifier) throw new Error('No code verifier found')
    return store.codeVerifier
  }

  async waitForCode(): Promise<string> {
    if (!this._pendingCode) throw new Error('No pending OAuth code')
    try {
      return await this._pendingCode
    } finally {
      this._cleanupCallback?.()
      this._pendingCode = null
      this._cleanupCallback = null
    }
  }
}

const buildPrompt = (schema: SiteSchema): string => {
  const { siteName, rootUrl, brandColors, pages } = schema
  const pageList = pages.map(p => `  - ${p.title} (${p.url})`).join('\n')

  return `Recreate this website as a modern, responsive Next.js + Tailwind CSS app.

Site: ${siteName} (${rootUrl})
Brand colors: primary ${brandColors.primary ?? 'not specified'}, secondary ${brandColors.secondary ?? 'not specified'}
Pages: ${pages.length}
${pageList}

Use the full content schema below to populate all pages with real content, navigation, and structure.
Preserve the site's information architecture, copy, and imagery. Apply a clean, modern design system.

Full content schema (JSON):
${JSON.stringify(schema, null, 2)}`
}

export const createLovableProject = async (schema: SiteSchema, verbose: boolean): Promise<string> => {
  const authProvider = new LovableAuthProvider()

  const transportOpts: SSEClientTransportOptions = { authProvider }
  const transport = new SSEClientTransport(new URL(LOVABLE_MCP_URL), transportOpts)
  const client = new Client({ name: 'the-modernizer', version: '0.0.0' })

  const connect = async (): Promise<void> => {
    try {
      await client.connect(transport)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        process.stdout.write(`Waiting for Lovable authorization...\n`)
        const code = await authProvider.waitForCode()
        await transport.finishAuth(code)
        await client.connect(transport)
      } else {
        throw err
      }
    }
  }

  await connect()

  const { tools } = await client.listTools()

  if (verbose) {
    process.stdout.write(`  Lovable MCP tools: ${tools.map(t => t.name).join(', ')}\n`)
  }

  const createTool = tools.find(t => t.name.toLowerCase().includes('create'))
  if (!createTool) {
    throw new Error(
      `No create tool found on Lovable MCP server.\n` +
      `  Available tools: ${tools.map(t => t.name).join(', ')}`
    )
  }

  if (verbose) {
    process.stdout.write(`  Using tool: ${createTool.name}\n`)
  }

  const result = await client.callTool({
    name: createTool.name,
    arguments: { prompt: buildPrompt(schema) },
  })

  await client.close()

  const content = result.content as Array<{ type: string; text?: string }>
  const text = content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && typeof c.text === 'string')
    .map(c => c.text)
    .join('\n')

  const urlMatch = text.match(/https?:\/\/[^\s]+lovable[^\s]*/i)
  if (urlMatch) return urlMatch[0]

  return text
}
