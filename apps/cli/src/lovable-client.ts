import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { exec } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientMetadata, OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { SiteSchema } from '@modernizer/schema'

// Public client ID from Lovable MCP docs (Cursor config example)
const LOVABLE_CLIENT_ID = '6d465f583e1e4ce5801b1616f735670c'
const LOVABLE_MCP_URL = process.env.LOVABLE_MCP_URL ?? 'https://mcp.lovable.dev'
const CALLBACK_PORT = 3742
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`

const CONFIG_DIR = join(homedir(), '.config', 'the-modernizer')
const AUTH_FILE = join(CONFIG_DIR, 'lovable-auth.json')

// ── Token storage ──────────────────────────────────────────────────────────

type AuthStore = {
  tokens?: OAuthTokens
  clientInfo?: OAuthClientInformationMixed
  codeVerifier?: string
}

const readAuthStore = async (): Promise<AuthStore> => {
  try {
    return JSON.parse(await readFile(AUTH_FILE, 'utf-8')) as AuthStore
  } catch {
    return {}
  }
}

const writeAuthStore = async (store: AuthStore): Promise<void> => {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(AUTH_FILE, JSON.stringify(store, null, 2))
}

// ── OAuth helpers ──────────────────────────────────────────────────────────

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
    res.end('<html><body><p>Lovable authorization complete. You can close this tab.</p></body></html>')
    server.close()
    if (code) resolve(code)
    else reject(new Error('No authorization code received in callback'))
  })

  server.listen(CALLBACK_PORT)
  server.on('error', reject)

  return {
    promise,
    cleanup: () => { try { server.close() } catch { /* ignore */ } },
  }
}

// ── OAuthClientProvider implementation ────────────────────────────────────

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
    // Use pre-known client ID — no dynamic registration needed
    return store.clientInfo ?? { client_id: LOVABLE_CLIENT_ID }
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
    process.stdout.write(`If it doesn't open automatically, visit:\n  ${authorizationUrl.toString()}\n\n`)
    openBrowser(authorizationUrl.toString())
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    const store = await readAuthStore()
    await writeAuthStore({ ...store, codeVerifier: verifier })
  }

  async codeVerifier(): Promise<string> {
    const store = await readAuthStore()
    if (!store.codeVerifier) throw new Error('No PKCE code verifier found — re-run to restart the OAuth flow')
    return store.codeVerifier
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    const store = await readAuthStore()
    if (scope === 'all') { await writeAuthStore({}); return }
    if (scope === 'tokens') await writeAuthStore({ ...store, tokens: undefined })
    if (scope === 'verifier') await writeAuthStore({ ...store, codeVerifier: undefined })
    if (scope === 'client') await writeAuthStore({ ...store, clientInfo: undefined })
  }

  async waitForCode(): Promise<string> {
    if (!this._pendingCode) throw new Error('No pending OAuth authorization')
    try {
      return await this._pendingCode
    } finally {
      this._cleanupCallback?.()
      this._pendingCode = null
      this._cleanupCallback = null
    }
  }
}

// ── Lovable MCP workflow ───────────────────────────────────────────────────

const buildInitialMessage = (schema: SiteSchema): string => {
  const { siteName, rootUrl, brandColors, pages, nav } = schema
  const pageList = pages.map(p => `  - ${p.title} (${p.archetype})`).join('\n')
  const navItems = nav.map(n => n.label).join(', ')

  return `Recreate this website as a modern, responsive React + Tailwind CSS app.

Site: ${siteName}
Original URL: ${rootUrl}
Brand colors: primary ${brandColors.primary ?? 'not specified'}, secondary ${brandColors.secondary ?? 'not specified'}
Navigation: ${navItems}
Pages (${pages.length}):
${pageList}

Preserve all content, copy, and site structure from the schema. Apply a clean, modern design system.

Full content schema (JSON):
${JSON.stringify(schema, null, 2)}`
}

export const createLovableProject = async (schema: SiteSchema, verbose: boolean): Promise<string> => {
  const authProvider = new LovableAuthProvider()
  const transport = new StreamableHTTPClientTransport(new URL(LOVABLE_MCP_URL), { authProvider })
  const client = new Client({ name: 'the-modernizer', version: '0.0.0' })

  // Connect, handling first-run OAuth
  try {
    await client.connect(transport)
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
    process.stdout.write(`Waiting for Lovable authorization (check your browser)...\n`)
    const code = await authProvider.waitForCode()
    await transport.finishAuth(code)
    await client.connect(transport)
  }

  if (verbose) {
    const { tools } = await client.listTools()
    process.stdout.write(`  Lovable MCP tools: ${tools.map(t => t.name).join(', ')}\n`)
  }

  // Step 1: get workspace ID
  const workspacesResult = await client.callTool({ name: 'list_workspaces', arguments: {} })
  const workspacesText = (workspacesResult.content as Array<{ type: string; text?: string }>)
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n')

  // Parse first workspace ID from the response
  const workspaceIdMatch = workspacesText.match(/"id"\s*:\s*"([^"]+)"/) ?? workspacesText.match(/id:\s*([^\s,\n]+)/)
  if (!workspaceIdMatch) {
    throw new Error(`Could not find workspace ID in response:\n${workspacesText}`)
  }
  const workspaceId = workspaceIdMatch[1]
  if (verbose) process.stdout.write(`  Workspace ID: ${workspaceId}\n`)

  // Step 2: create project
  process.stdout.write(`  Creating Lovable project...\n`)
  const createResult = await client.callTool({
    name: 'create_project',
    arguments: {
      workspace_id: workspaceId,
      description: schema.siteName,
      initial_message: buildInitialMessage(schema),
    },
  })

  const createText = (createResult.content as Array<{ type: string; text?: string }>)
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n')

  // Parse project ID from create response
  const projectIdMatch = createText.match(/"id"\s*:\s*"([^"]+)"/) ?? createText.match(/project[_\s]id[:\s]+([^\s,\n]+)/i)
  if (!projectIdMatch) {
    throw new Error(`Could not find project ID in response:\n${createText}`)
  }
  const projectId = projectIdMatch[1]
  if (verbose) process.stdout.write(`  Project ID: ${projectId}\n`)

  // Step 3: deploy
  process.stdout.write(`  Deploying...\n`)
  const deployResult = await client.callTool({
    name: 'deploy_project',
    arguments: { project_id: projectId },
  })

  await client.close()

  const deployText = (deployResult.content as Array<{ type: string; text?: string }>)
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n')

  const urlMatch = deployText.match(/https?:\/\/[^\s"']+/)
  if (urlMatch) return urlMatch[0]

  return deployText
}
