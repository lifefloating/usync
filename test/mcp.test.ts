import type { ProviderName } from '../src/types.js'
import type { CanonicalMCPServer } from '../src/utils/mcp.js'
import fc from 'fast-check'
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { parseMCPFromProvider, serializeMCPForProvider } from '../src/utils/mcp.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']

/**
 * Generator for a valid server name: non-empty alphanumeric + hyphens,
 * safe as a JSON object key.
 */
const serverNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/)

/**
 * Generator for a non-empty command string.
 */
// eslint-disable-next-line regexp/use-ignore-case
const commandArb = fc.stringMatching(/^[a-zA-Z][\w./-]{0,29}$/)

/**
 * Generator for a single arg string (non-empty, no control chars).
 */
const argArb = fc.stringMatching(/^[\w@./:=-]{1,30}$/)

/**
 * Generator for env key (valid env var name).
 */
const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,19}$/)

/**
 * Generator for env value.
 */
const envValueArb = fc.stringMatching(/^[\w./-]{1,30}$/)

/**
 * Generator for optional env record.
 * Returns undefined or a non-empty record.
 */
const envArb = fc.oneof(
  fc.constant(undefined),
  fc.dictionary(envKeyArb, envValueArb, { minKeys: 1, maxKeys: 5 }),
)

/**
 * Generator for a single CanonicalMCPServer.
 */
const serverArb: fc.Arbitrary<CanonicalMCPServer> = fc.record({
  name: serverNameArb,
  transport: fc.constant('stdio' as const),
  command: commandArb,
  args: fc.array(argArb, { minLength: 0, maxLength: 5 }),
  env: envArb,
})

/**
 * Generator for a list of CanonicalMCPServer with unique names.
 */
const serverListArb = fc
  .array(serverArb, { minLength: 0, maxLength: 5 })
  .map((servers) => {
    const seen = new Set<string>()
    return servers.filter((s) => {
      if (seen.has(s.name))
        return false
      seen.add(s.name)
      return true
    })
  })

/**
 * Normalize a server for comparison: treat undefined env and empty env as equivalent.
 */
function normalizeServer(s: CanonicalMCPServer): CanonicalMCPServer {
  const base: CanonicalMCPServer = { name: s.name, transport: s.transport }
  if (s.transport === 'url') {
    base.url = s.url
  }
  else {
    base.command = s.command ?? ''
    base.args = [...(s.args ?? [])]
  }
  if (s.headers && Object.keys(s.headers).length > 0) {
    base.headers = { ...s.headers }
  }
  if (s.env && Object.keys(s.env).length > 0) {
    base.env = { ...s.env }
  }
  return base
}

function normalizeList(servers: CanonicalMCPServer[]): CanonicalMCPServer[] {
  return servers.map(normalizeServer).sort((a, b) => a.name.localeCompare(b.name))
}

describe('mCP property tests', () => {
  /**
   * **Feature: tool-migration, Property 2: MCP 配置跨工具往返一致性**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.4**
   *
   * For any valid CanonicalMCPServer list and any target ProviderName,
   * serializing to that provider's format and then parsing back should
   * produce an equivalent list (same name, command, args, env).
   */
  it.each(ALL_PROVIDERS)(
    'round-trip consistency for provider: %s',
    (provider) => {
      fc.assert(
        fc.property(serverListArb, (servers) => {
          const serialized = serializeMCPForProvider(provider, servers)
          const parsed = parseMCPFromProvider(provider, serialized)

          const expected = normalizeList(servers)
          const actual = normalizeList(parsed)

          expect(actual).toEqual(expected)
        }),
        { numRuns: 100 },
      )
    },
  )
})

describe('mCP extra fields property tests', () => {
  /**
   * Generator for random extra field keys (not command, args, env, or name).
   */
  const extraFieldKeyArb = fc.stringMatching(/^[a-z][a-zA-Z]{1,15}$/).filter(
    k => !['command', 'args', 'env', 'name'].includes(k),
  )

  /**
   * Generator for random extra field values (string, number, boolean, or array).
   */
  const extraFieldValueArb = fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer(),
    fc.boolean(),
    fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  )

  /**
   * Generator for a record of extra fields (at least 1).
   */
  const extraFieldsArb = fc.dictionary(extraFieldKeyArb, extraFieldValueArb, { minKeys: 1, maxKeys: 5 })

  /**
   * Build a provider-specific MCP config string with extra fields injected into server entries.
   * Returns TOML for codex, JSON for all others.
   */
  function buildMCPConfigWithExtras(
    provider: ProviderName,
    servers: { name: string, command?: string, args?: string[], env?: Record<string, string> }[],
    extraFieldsPerServer: Record<string, unknown>[],
  ): string {
    const serversObj: Record<string, Record<string, unknown>> = {}
    for (let i = 0; i < servers.length; i++) {
      const s = servers[i]
      if (provider === 'opencode') {
        // OpenCode format: type, command (array), environment
        const entry: Record<string, unknown> = {
          type: 'local',
          command: [s.command ?? '', ...(s.args ?? [])],
          ...extraFieldsPerServer[i],
        }
        if (s.env && Object.keys(s.env).length > 0) {
          entry.environment = s.env
        }
        serversObj[s.name] = entry
      }
      else {
        const entry: Record<string, unknown> = {
          command: s.command ?? '',
          args: s.args ?? [],
          ...extraFieldsPerServer[i],
        }
        if (s.env && Object.keys(s.env).length > 0) {
          entry.env = s.env
        }
        serversObj[s.name] = entry
      }
    }

    if (provider === 'codex') {
      return stringifyTOML({ mcp_servers: serversObj })
    }
    if (provider === 'opencode') {
      return JSON.stringify({ mcp: serversObj }, null, 2)
    }
    return JSON.stringify({ mcpServers: serversObj }, null, 2)
  }

  const CANONICAL_KEYS = new Set(['name', 'transport', 'command', 'args', 'env', 'url', 'headers'])

  /**
   * **Feature: tool-migration, Property 3: 额外 MCP 字段在转换时被丢弃**
   * **Validates: Requirements 6.3**
   *
   * For any MCP config JSON that contains extra fields on server entries,
   * parsing should only retain name, command, args, env.
   * Extra fields should NOT appear in the parsed CanonicalMCPServer objects.
   */
  it.each(ALL_PROVIDERS)(
    'extra fields are discarded when parsing for provider: %s',
    (provider) => {
      const serverWithExtrasArb = fc.tuple(serverArb, extraFieldsArb)
      const serverListWithExtrasArb = fc
        .array(serverWithExtrasArb, { minLength: 1, maxLength: 5 })
        .map((pairs) => {
          const seen = new Set<string>()
          return pairs.filter(([s]) => {
            if (seen.has(s.name))
              return false
            seen.add(s.name)
            return true
          })
        })
        .filter(pairs => pairs.length > 0)

      fc.assert(
        fc.property(serverListWithExtrasArb, (pairs) => {
          const servers = pairs.map(([s]) => s)
          const extraFields = pairs.map(([, e]) => e)

          const json = buildMCPConfigWithExtras(provider, servers, extraFields)
          const parsed = parseMCPFromProvider(provider, json)

          // Every parsed server should only have canonical keys
          for (const server of parsed) {
            const keys = Object.keys(server)
            for (const key of keys) {
              expect(CANONICAL_KEYS.has(key)).toBe(true)
            }
          }

          // Parsed count should match input count
          expect(parsed.length).toBe(servers.length)

          // Verify the canonical fields are preserved correctly
          for (const server of parsed) {
            const original = servers.find(s => s.name === server.name)
            expect(original).toBeDefined()
            expect(server.command).toBe(original!.command)
            expect(server.args).toEqual(original!.args)
            if (original!.env && Object.keys(original!.env).length > 0) {
              expect(server.env).toEqual(original!.env)
            }
          }
        }),
        { numRuns: 100 },
      )
    },
  )
})

// ============================================================
// Unit tests for MCP parsing and serialization (Task 3.4)
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
// ============================================================

describe('parseMCPFromProvider - concrete examples', () => {
  const sampleServer: CanonicalMCPServer = {
    name: 'my-server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@some/mcp-server'],
    env: { API_KEY: 'test-key' },
  }

  describe('claude (mcpServers field path)', () => {
    it('parses a valid claude MCP config', () => {
      const config = JSON.stringify({
        mcpServers: {
          'my-server': {
            command: 'npx',
            args: ['-y', '@some/mcp-server'],
            env: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('claude', config)
      expect(result).toEqual([sampleServer])
    })

    it('parses multiple servers', () => {
      const config = JSON.stringify({
        mcpServers: {
          'server-a': { command: 'cmd-a', args: ['--flag'] },
          'server-b': { command: 'cmd-b', args: [], env: { KEY: 'val' } },
        },
      })
      const result = parseMCPFromProvider('claude', config)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ name: 'server-a', transport: 'stdio', command: 'cmd-a', args: ['--flag'] })
      expect(result[1]).toEqual({ name: 'server-b', transport: 'stdio', command: 'cmd-b', args: [], env: { KEY: 'val' } })
    })
  })

  describe('opencode (mcp.<name> field path)', () => {
    it('parses a valid opencode MCP config', () => {
      const config = JSON.stringify({
        mcp: {
          'my-server': {
            type: 'local',
            command: ['npx', '-y', '@some/mcp-server'],
            environment: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('opencode', config)
      expect(result).toEqual([sampleServer])
    })

    it('returns empty array when mcp field is missing', () => {
      const config = JSON.stringify({ mcpServers: { s: { command: 'x', args: [] } } })
      const result = parseMCPFromProvider('opencode', config)
      expect(result).toEqual([])
    })

    it('returns empty array when mcp is empty', () => {
      const config = JSON.stringify({ mcp: {} })
      const result = parseMCPFromProvider('opencode', config)
      expect(result).toEqual([])
    })

    it('parses remote opencode server', () => {
      const config = JSON.stringify({
        mcp: {
          'remote-srv': {
            type: 'remote',
            url: 'https://example.com/mcp',
          },
        },
      })
      const result = parseMCPFromProvider('opencode', config)
      expect(result).toEqual([{ name: 'remote-srv', transport: 'url', url: 'https://example.com/mcp' }])
    })
  })

  describe('codex (mcp_servers field path, TOML format)', () => {
    it('parses a valid codex MCP config in TOML', () => {
      const config = `
[mcp_servers.my-server]
command = "npx"
args = ["-y", "@some/mcp-server"]

[mcp_servers.my-server.env]
API_KEY = "test-key"
`
      const result = parseMCPFromProvider('codex', config)
      expect(result).toEqual([sampleServer])
    })
  })

  describe('gemini (mcpServers field path)', () => {
    it('parses a valid gemini MCP config', () => {
      const config = JSON.stringify({
        mcpServers: {
          'my-server': {
            command: 'npx',
            args: ['-y', '@some/mcp-server'],
            env: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('gemini', config)
      expect(result).toEqual([sampleServer])
    })
  })

  describe('kiro (mcpServers field path)', () => {
    it('parses a valid kiro MCP config', () => {
      const config = JSON.stringify({
        mcpServers: {
          'my-server': {
            command: 'npx',
            args: ['-y', '@some/mcp-server'],
            env: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('kiro', config)
      expect(result).toEqual([sampleServer])
    })
  })

  describe('qoder (mcpServers field path)', () => {
    it('parses a valid qoder MCP config', () => {
      const config = JSON.stringify({
        mcpServers: {
          'my-server': {
            command: 'npx',
            args: ['-y', '@some/mcp-server'],
            env: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('qoder', config)
      expect(result).toEqual([sampleServer])
    })
  })

  describe('cursor (mcpServers field path)', () => {
    it('parses a valid cursor MCP config', () => {
      const config = JSON.stringify({
        mcpServers: {
          'my-server': {
            command: 'npx',
            args: ['-y', '@some/mcp-server'],
            env: { API_KEY: 'test-key' },
          },
        },
      })
      const result = parseMCPFromProvider('cursor', config)
      expect(result).toEqual([sampleServer])
    })
  })
})

describe('parseMCPFromProvider - mcp-remote bridge detection', () => {
  it('detects npx mcp-remote@latest pattern and converts to URL transport with headers', () => {
    const config = JSON.stringify({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', 'mcp-remote@latest', 'https://api.githubcopilot.com/mcp/', '--header', 'Authorization: Bearer token123'],
        },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].url).toBe('https://api.githubcopilot.com/mcp/')
    expect(result[0].headers).toEqual({ Authorization: 'Bearer token123' })
    expect(result[0].command).toBeUndefined()
    expect(result[0].args).toBeUndefined()
  })

  it('detects cmd /c npx mcp-remote pattern (Windows) with headers', () => {
    const config = JSON.stringify({
      mcpServers: {
        github: {
          command: 'cmd',
          args: ['/c', 'npx', '-y', 'mcp-remote@latest', 'https://api.githubcopilot.com/mcp/', '--header', 'Authorization: Bearer token'],
        },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].url).toBe('https://api.githubcopilot.com/mcp/')
    expect(result[0].headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('does not false-positive on non-mcp-remote commands', () => {
    const config = JSON.stringify({
      mcpServers: {
        normal: {
          command: 'npx',
          args: ['-y', '@some/mcp-server', 'https://not-a-remote-url.com'],
        },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('stdio')
    expect(result[0].command).toBe('npx')
  })

  it('detects mcp-remote in opencode format', () => {
    const config = JSON.stringify({
      mcp: {
        github: {
          type: 'local',
          command: ['npx', '-y', 'mcp-remote@latest', 'https://api.githubcopilot.com/mcp/', '--header', 'Authorization: Bearer tok'],
        },
      },
    })
    const result = parseMCPFromProvider('opencode', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].url).toBe('https://api.githubcopilot.com/mcp/')
    expect(result[0].headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('detects mcp-remote in codex TOML format', () => {
    const config = `
[mcp_servers.github]
command = "npx"
args = ["-y", "mcp-remote@latest", "https://api.githubcopilot.com/mcp/", "--header", "Authorization: Bearer tok"]
`
    const result = parseMCPFromProvider('codex', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].url).toBe('https://api.githubcopilot.com/mcp/')
    expect(result[0].headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('mcp-remote without --header has no headers', () => {
    const config = JSON.stringify({
      mcpServers: {
        remote: {
          command: 'npx',
          args: ['-y', 'mcp-remote', 'https://example.com/mcp'],
        },
      },
    })
    const result = parseMCPFromProvider('kiro', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].url).toBe('https://example.com/mcp')
    expect(result[0].headers).toBeUndefined()
  })

  it('parses headers from claude native HTTP config', () => {
    const config = JSON.stringify({
      mcpServers: {
        github: {
          type: 'http',
          url: 'https://api.githubcopilot.com/mcp/',
          headers: { Authorization: 'Bearer ghp_xxx' },
        },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result).toHaveLength(1)
    expect(result[0].transport).toBe('url')
    expect(result[0].headers).toEqual({ Authorization: 'Bearer ghp_xxx' })
  })

  it('serializes headers to claude format', () => {
    const servers: CanonicalMCPServer[] = [{
      name: 'github',
      transport: 'url',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: { Authorization: 'Bearer ghp_xxx' },
    }]
    const serialized = serializeMCPForProvider('claude', servers)
    const parsed = JSON.parse(serialized)
    expect(parsed.mcpServers.github.type).toBe('http')
    expect(parsed.mcpServers.github.url).toBe('https://api.githubcopilot.com/mcp/')
    expect(parsed.mcpServers.github.headers).toEqual({ Authorization: 'Bearer ghp_xxx' })
  })
})

describe('parseMCPFromProvider - edge cases', () => {
  it('returns empty array for invalid JSON', () => {
    const result = parseMCPFromProvider('claude', 'not-json{{{')
    expect(result).toEqual([])
  })

  it('returns empty array for JSON that is not an object', () => {
    expect(parseMCPFromProvider('claude', '"hello"')).toEqual([])
    expect(parseMCPFromProvider('claude', '42')).toEqual([])
    expect(parseMCPFromProvider('claude', 'null')).toEqual([])
    expect(parseMCPFromProvider('claude', '[]')).toEqual([])
  })

  it('returns empty array for empty object (no mcpServers field)', () => {
    const result = parseMCPFromProvider('claude', '{}')
    expect(result).toEqual([])
  })

  it('returns empty array when mcpServers is not an object', () => {
    const result = parseMCPFromProvider('claude', JSON.stringify({ mcpServers: 'bad' }))
    expect(result).toEqual([])
  })

  it('returns empty array for empty mcpServers object', () => {
    const result = parseMCPFromProvider('claude', JSON.stringify({ mcpServers: {} }))
    expect(result).toEqual([])
  })

  it('skips server entries that are not objects', () => {
    const config = JSON.stringify({
      mcpServers: {
        'valid-server': { command: 'cmd', args: [] },
        'bad-server': 'not-an-object',
        'null-server': null,
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('valid-server')
  })

  it('defaults command to empty string when missing', () => {
    const config = JSON.stringify({
      mcpServers: {
        'no-cmd': { args: ['--flag'] },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].command).toBe('')
  })

  it('defaults args to empty array when missing', () => {
    const config = JSON.stringify({
      mcpServers: {
        'no-args': { command: 'cmd' },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].args).toEqual([])
  })

  it('filters out non-string args', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: ['valid', 123, null, 'also-valid'] },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].args).toEqual(['valid', 'also-valid'])
  })

  it('omits env when it is not an object', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: [], env: 'not-object' },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].env).toBeUndefined()
  })

  it('omits env when it is an array', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: [], env: ['a', 'b'] },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].env).toBeUndefined()
  })

  it('filters out non-string env values', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: [], env: { GOOD: 'val', BAD: 123, ALSO_BAD: null } },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].env).toEqual({ GOOD: 'val' })
  })

  it('omits env when all values are non-string', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: [], env: { BAD: 123 } },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0].env).toBeUndefined()
  })

  it('ignores extra fields on server entries', () => {
    const config = JSON.stringify({
      mcpServers: {
        s: { command: 'cmd', args: [], disabled: true, timeout: 5000 },
      },
    })
    const result = parseMCPFromProvider('claude', config)
    expect(result[0]).toEqual({ name: 's', transport: 'stdio', command: 'cmd', args: [] })
    expect((result[0] as any).disabled).toBeUndefined()
    expect((result[0] as any).timeout).toBeUndefined()
  })
})

describe('serializeMCPForProvider - concrete examples', () => {
  const servers: CanonicalMCPServer[] = [
    { name: 'server-a', transport: 'stdio', command: 'npx', args: ['-y', '@pkg/a'], env: { KEY: 'val' } },
    { name: 'server-b', transport: 'stdio', command: 'node', args: ['index.js'] },
  ]

  it('serializes to mcpServers format for claude', () => {
    const json = JSON.parse(serializeMCPForProvider('claude', servers))
    expect(json.mcpServers['server-a']).toEqual({
      command: 'npx',
      args: ['-y', '@pkg/a'],
      env: { KEY: 'val' },
    })
    expect(json.mcpServers['server-b']).toEqual({
      command: 'node',
      args: ['index.js'],
    })
    expect(json.mcp).toBeUndefined()
  })

  it('serializes to mcp format for opencode', () => {
    const json = JSON.parse(serializeMCPForProvider('opencode', servers))
    expect(json.mcp['server-a']).toEqual({
      type: 'local',
      command: ['npx', '-y', '@pkg/a'],
      environment: { KEY: 'val' },
    })
    expect(json.mcp['server-b']).toEqual({
      type: 'local',
      command: ['node', 'index.js'],
    })
    expect(json.mcpServers).toBeUndefined()
  })

  it('serializes to mcp_servers TOML format for codex', () => {
    const toml = serializeMCPForProvider('codex', servers)
    const parsed = parseTOML(toml) as Record<string, unknown>
    const mcpServers = parsed.mcp_servers as Record<string, Record<string, unknown>>
    expect(mcpServers['server-a']).toBeDefined()
    expect(mcpServers['server-a'].command).toBe('npx')
    expect(mcpServers['server-b']).toBeDefined()
    expect(mcpServers['server-b'].command).toBe('node')
  })

  it('serializes to mcpServers format for gemini', () => {
    const json = JSON.parse(serializeMCPForProvider('gemini', servers))
    expect(json.mcpServers).toBeDefined()
    expect(json.mcp).toBeUndefined()
  })

  it('serializes to mcpServers format for kiro', () => {
    const json = JSON.parse(serializeMCPForProvider('kiro', servers))
    expect(json.mcpServers).toBeDefined()
    expect(json.mcp).toBeUndefined()
  })

  it('serializes to mcpServers format for qoder', () => {
    const json = JSON.parse(serializeMCPForProvider('qoder', servers))
    expect(json.mcpServers).toBeDefined()
    expect(json.mcp).toBeUndefined()
  })

  it('serializes to mcpServers format for cursor', () => {
    const json = JSON.parse(serializeMCPForProvider('cursor', servers))
    expect(json.mcpServers).toBeDefined()
    expect(json.mcp).toBeUndefined()
  })

  it('serializes empty server list', () => {
    const json = JSON.parse(serializeMCPForProvider('claude', []))
    expect(json.mcpServers).toEqual({})
  })

  it('omits env field when env is empty', () => {
    const s: CanonicalMCPServer[] = [{ name: 'x', transport: 'stdio', command: 'cmd', args: [], env: {} }]
    const json = JSON.parse(serializeMCPForProvider('claude', s))
    expect(json.mcpServers.x.env).toBeUndefined()
  })
})
