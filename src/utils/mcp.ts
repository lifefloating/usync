import type { ProviderName } from '../types.js'
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml'
import consola from 'consola'

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
  env?: Record<string, string>
}

const KNOWN_SERVER_KEYS = new Set(['command', 'args', 'env', 'url', 'bearer_token_env_var', 'startup_timeout_sec'])

/**
 * Get the MCP field path for a given provider.
 * OpenCode uses `mcp.servers`, codex uses `mcp_servers`, all others use `mcpServers`.
 */
function getMCPServersFromConfig(provider: ProviderName, config: Record<string, unknown>): Record<string, unknown> | undefined {
  if (provider === 'opencode') {
    const mcp = config.mcp as Record<string, unknown> | undefined
    return mcp?.servers as Record<string, unknown> | undefined
  }
  if (provider === 'codex') {
    return config.mcp_servers as Record<string, unknown> | undefined
  }
  return config.mcpServers as Record<string, unknown> | undefined
}

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

    // Warn about extra fields
    for (const key of Object.keys(entry)) {
      if (!KNOWN_SERVER_KEYS.has(key)) {
        consola.warn(`[mcp] Ignoring unsupported field "${key}" in server "${name}" for provider "${provider}"`)
      }
    }

    const server: CanonicalMCPServer = { name, transport: 'stdio' }

    // Detect transport type: url-based or command-based
    if (typeof entry.url === 'string' && entry.url) {
      server.transport = 'url'
      server.url = entry.url
    }
    else {
      server.transport = 'stdio'
      server.command = typeof entry.command === 'string' ? entry.command : ''
      server.args = Array.isArray(entry.args) ? entry.args.filter((a): a is string => typeof a === 'string') : []
    }

    if (entry.env && typeof entry.env === 'object' && !Array.isArray(entry.env)) {
      const env: Record<string, string> = {}
      for (const [k, v] of Object.entries(entry.env as Record<string, unknown>)) {
        if (typeof v === 'string') {
          env[k] = v
        }
      }
      if (Object.keys(env).length > 0) {
        server.env = env
      }
    }

    result.push(server)
  }

  return result
}


/**
 * Serialize an array of CanonicalMCPServer into a formatted string
 * for the target provider.
 * Codex uses TOML with `[mcp_servers]`, OpenCode uses JSON `{ mcp: { servers: { ... } } }`,
 * all others use JSON `{ mcpServers: { ... } }`.
 */
export function serializeMCPForProvider(provider: ProviderName, servers: CanonicalMCPServer[]): string {
  const serversObj: Record<string, Record<string, unknown>> = {}

  for (const server of servers) {
    const entry: Record<string, unknown> = {}
    if (server.transport === 'url') {
      entry.url = server.url
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

  if (provider === 'opencode') {
    return JSON.stringify({ mcp: { servers: serversObj } }, null, 2)
  }

  return JSON.stringify({ mcpServers: serversObj }, null, 2)
}
