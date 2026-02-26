import type { ProviderName } from '../types.js'
import consola from 'consola'
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml'

export interface CanonicalMCPServer {
  name: string
  /** Transport type: 'stdio' for command-based, 'url' for HTTP/SSE-based */
  transport: 'stdio' | 'url'
  /** Command to run (stdio transport only) */
  command?: string
  /** Command arguments (stdio transport only) */
  args?: string[]
  /** Remote server URL (url transport only) */
  url?: string
  /** HTTP headers for URL transport (e.g. Authorization) */
  headers?: Record<string, string>
  env?: Record<string, string>
}

const KNOWN_SERVER_KEYS = new Set([
  'command',
  'args',
  'env',
  'url',
  // codex-specific
  'bearer_token_env_var',
  'startup_timeout_sec',
  'tool_timeout_sec',
  'enabled',
  'required',
  'enabled_tools',
  'disabled_tools',
  'cwd',
  'env_vars',
  'http_headers',
  'env_http_headers',
  // opencode-specific
  'type',
  'environment',
  'timeout',
  'headers',
  'oauth',
  // gemini-specific
  'httpUrl',
  'trust',
  'includeTools',
  'excludeTools',
  'targetAudience',
  'targetServiceAccount',
  'authProviderType',
  // cursor-specific
  'disabled',
  'autoApprove',
  // claude code specific
  'type',
])

/** Parse config content string into an object, handling both JSON and TOML formats */
function parseConfigContent(provider: ProviderName, configContent: string): Record<string, unknown> | null {
  if (provider === 'codex') {
    try {
      return parseTOML(configContent) as Record<string, unknown>
    }
    catch {
      return null
    }
  }
  try {
    return JSON.parse(configContent)
  }
  catch {
    return null
  }
}

/**
 * Get the MCP servers object from a parsed config, handling provider-specific field paths.
 *
 * Provider formats (from official docs):
 * - claude: { mcpServers: { ... } } (both ~/.claude.json and .mcp.json)
 * - codex: [mcp_servers] in TOML
 * - opencode: { mcp: { <name>: { type, command, ... } } } — servers are direct children of mcp
 * - gemini: { mcpServers: { ... } }
 * - kiro: { mcpServers: { ... } }
 * - qoder: { mcpServers: { ... } }
 * - cursor: { mcpServers: { ... } }
 */
function getMCPServersFromConfig(provider: ProviderName, config: Record<string, unknown>): Record<string, unknown> | undefined {
  if (provider === 'opencode') {
    // OpenCode: mcp.<name> directly (not mcp.servers)
    return config.mcp as Record<string, unknown> | undefined
  }
  if (provider === 'codex') {
    return config.mcp_servers as Record<string, unknown> | undefined
  }
  // All others use mcpServers
  return config.mcpServers as Record<string, unknown> | undefined
}

interface McpRemoteDetection {
  url: string
  headers?: Record<string, string>
}

/**
 * Detect if a stdio command is actually an `mcp-remote` bridge wrapping a URL.
 * Pattern: `npx -y mcp-remote@... <url>` or `mcp-remote <url>`
 * Also extracts `--header "Key: Value"` pairs.
 * Returns { url, headers } if detected, otherwise null.
 */
function detectMcpRemoteUrl(command: string, args: string[]): McpRemoteDetection | null {
  const allParts = [command, ...args]

  // Find the mcp-remote package reference in the command parts
  const remoteIdx = allParts.findIndex(part =>
    part === 'mcp-remote' || part.startsWith('mcp-remote@'),
  )
  if (remoteIdx === -1)
    return null

  let url: string | null = null
  const headers: Record<string, string> = {}

  for (let i = remoteIdx + 1; i < allParts.length; i++) {
    const part = allParts[i]
    if (part === '--header' && i + 1 < allParts.length) {
      // --header "Key: Value" or --header Key: Value (may be split across args)
      const headerVal = allParts[i + 1]
      const colonIdx = headerVal.indexOf(':')
      if (colonIdx > 0) {
        const key = headerVal.slice(0, colonIdx).trim()
        const value = headerVal.slice(colonIdx + 1).trim()
        if (key && value)
          headers[key] = value
      }
      i++ // skip the header value
      continue
    }
    if (part.startsWith('--') || part.startsWith('-'))
      continue
    // Check if it looks like a URL
    if (!url && (part.startsWith('http://') || part.startsWith('https://'))) {
      url = part
    }
  }

  if (!url)
    return null
  return { url, headers: Object.keys(headers).length > 0 ? headers : undefined }
}

/** Extract command and args from an OpenCode server entry (command is an array) */
function parseOpenCodeServer(name: string, entry: Record<string, unknown>): CanonicalMCPServer | null {
  const serverType = entry.type as string | undefined

  if (serverType === 'remote') {
    // Remote server with URL
    const url = entry.url as string | undefined
    if (!url)
      return null
    const server: CanonicalMCPServer = { name, transport: 'url', url }
    // OpenCode supports headers for remote servers
    const hdrs = parseHeadersField(entry.headers)
    if (hdrs)
      server.headers = hdrs
    return server
  }

  // Local server: command is an array [cmd, ...args]
  const cmdArray = entry.command
  if (Array.isArray(cmdArray) && cmdArray.length > 0) {
    const command = String(cmdArray[0])
    const args = cmdArray.slice(1).map(String)

    // Detect mcp-remote bridge pattern → convert to URL transport
    const remote = detectMcpRemoteUrl(command, args)
    if (remote) {
      const server: CanonicalMCPServer = { name, transport: 'url', url: remote.url }
      if (remote.headers)
        server.headers = remote.headers
      return server
    }

    const server: CanonicalMCPServer = { name, transport: 'stdio', command, args }

    // OpenCode uses "environment" not "env"
    const envObj = entry.environment as Record<string, unknown> | undefined
    if (envObj && typeof envObj === 'object' && !Array.isArray(envObj)) {
      const env: Record<string, string> = {}
      for (const [k, v] of Object.entries(envObj)) {
        if (typeof v === 'string')
          env[k] = v
      }
      if (Object.keys(env).length > 0)
        server.env = env
    }
    return server
  }

  return null
}

/** Parse a headers field from a config entry (Record<string, string>) */
function parseHeadersField(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string')
      headers[k] = v
  }
  return Object.keys(headers).length > 0 ? headers : undefined
}

/** Parse a standard server entry (claude, kiro, qoder, gemini, cursor) */
function parseStandardServer(name: string, entry: Record<string, unknown>): CanonicalMCPServer {
  const server: CanonicalMCPServer = { name, transport: 'stdio' }

  // Detect transport type
  if (typeof entry.url === 'string' && entry.url) {
    server.transport = 'url'
    server.url = entry.url
  }
  else if (typeof entry.httpUrl === 'string' && entry.httpUrl) {
    // Gemini CLI uses httpUrl for HTTP transport
    server.transport = 'url'
    server.url = entry.httpUrl
  }
  else if (entry.type === 'http' || entry.type === 'sse') {
    // Claude Code HTTP/SSE type
    if (typeof entry.url === 'string') {
      server.transport = 'url'
      server.url = entry.url
    }
  }
  else {
    server.transport = 'stdio'
    server.command = typeof entry.command === 'string' ? entry.command : ''
    server.args = Array.isArray(entry.args) ? entry.args.filter((a): a is string => typeof a === 'string') : []

    // Detect mcp-remote bridge pattern → convert to URL transport
    const remote = detectMcpRemoteUrl(server.command, server.args)
    if (remote) {
      server.transport = 'url'
      server.url = remote.url
      if (remote.headers)
        server.headers = remote.headers
      delete server.command
      delete server.args
    }
  }

  // Parse headers for URL transport servers (from native config, not mcp-remote)
  if (server.transport === 'url' && !server.headers) {
    // Standard providers use "headers", codex uses "http_headers"
    const hdrs = parseHeadersField(entry.headers) || parseHeadersField(entry.http_headers)
    if (hdrs)
      server.headers = hdrs
  }

  if (entry.env && typeof entry.env === 'object' && !Array.isArray(entry.env)) {
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(entry.env as Record<string, unknown>)) {
      if (typeof v === 'string')
        env[k] = v
    }
    if (Object.keys(env).length > 0)
      server.env = env
  }

  return server
}

/**
 * Parse MCP server configuration from a provider's config string (JSON or TOML).
 * Returns an array of CanonicalMCPServer, ignoring extra fields with warnings.
 * Returns empty array if parsing fails or expected fields are missing.
 */
export function parseMCPFromProvider(provider: ProviderName, configContent: string): CanonicalMCPServer[] {
  const config = parseConfigContent(provider, configContent)
  if (!config || typeof config !== 'object') {
    return []
  }

  const serversObj = getMCPServersFromConfig(provider, config)
  if (!serversObj || typeof serversObj !== 'object') {
    return []
  }

  const result: CanonicalMCPServer[] = []

  for (const [name, value] of Object.entries(serversObj)) {
    if (typeof value !== 'object' || value === null) {
      continue
    }

    const entry = value as Record<string, unknown>

    // Warn about extra fields (only for non-opencode providers)
    if (provider !== 'opencode') {
      for (const key of Object.keys(entry)) {
        if (!KNOWN_SERVER_KEYS.has(key)) {
          consola.warn(`[mcp] Ignoring unsupported field "${key}" in server "${name}" for provider "${provider}"`)
        }
      }
    }

    if (provider === 'opencode') {
      const server = parseOpenCodeServer(name, entry)
      if (server)
        result.push(server)
    }
    else {
      result.push(parseStandardServer(name, entry))
    }
  }

  return result
}

/**
 * Serialize an array of CanonicalMCPServer into a formatted string
 * for the target provider.
 *
 * Provider output formats:
 * - codex: TOML with [mcp_servers]
 * - opencode: JSON { mcp: { <name>: { type, command, environment } } }
 * - all others: JSON { mcpServers: { ... } }
 */
export function serializeMCPForProvider(provider: ProviderName, servers: CanonicalMCPServer[]): string {
  if (provider === 'opencode') {
    // OpenCode format: mcp.<name> with type/command array/environment
    const mcpObj: Record<string, Record<string, unknown>> = {}
    for (const server of servers) {
      const entry: Record<string, unknown> = {}
      if (server.transport === 'url') {
        entry.type = 'remote'
        entry.url = server.url
        if (server.headers && Object.keys(server.headers).length > 0) {
          entry.headers = server.headers
        }
      }
      else {
        entry.type = 'local'
        entry.command = [server.command ?? '', ...(server.args ?? [])]
      }
      if (server.env && Object.keys(server.env).length > 0) {
        entry.environment = server.env
      }
      mcpObj[server.name] = entry
    }
    return JSON.stringify({ mcp: mcpObj }, null, 2)
  }

  // Standard mcpServers format
  const serversObj: Record<string, Record<string, unknown>> = {}
  for (const server of servers) {
    const entry: Record<string, unknown> = {}
    if (server.transport === 'url') {
      if (provider === 'claude') {
        // Claude Code requires "type": "http" for URL-based servers
        entry.type = 'http'
        entry.url = server.url
      }
      else if (provider === 'gemini') {
        // Gemini CLI uses "httpUrl" for HTTP streaming transport
        entry.httpUrl = server.url
      }
      else if (provider === 'cursor') {
        // Cursor uses "url" with "type": "sse" for remote servers
        entry.type = 'sse'
        entry.url = server.url
      }
      else {
        entry.url = server.url
      }
      // Write headers for URL transport servers
      if (server.headers && Object.keys(server.headers).length > 0) {
        if (provider === 'codex') {
          entry.http_headers = server.headers
        }
        else {
          entry.headers = server.headers
        }
      }
    }
    else {
      entry.command = server.command ?? ''
      entry.args = server.args ?? []
    }
    if (server.env && Object.keys(server.env).length > 0) {
      entry.env = server.env
    }
    serversObj[server.name] = entry
  }

  if (provider === 'codex') {
    return stringifyTOML({ mcp_servers: serversObj })
  }

  return JSON.stringify({ mcpServers: serversObj }, null, 2)
}
