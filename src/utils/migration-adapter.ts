import type { ProviderName } from '../types.js'
import type { CanonicalMCPServer } from './mcp.js'
import type { MigrationScope } from './migration-paths.js'
import fs from 'node:fs/promises'
import { basename, join, relative } from 'pathe'
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml'
import { ensureParentDir, exists, walkFiles } from './fs.js'
import { parseMCPFromProvider } from './mcp.js'
import { getMCPConfigPath, getSkillsDir, isStructuredSkills } from './migration-paths.js'

export interface SkillFile {
  /** Relative path within the skills directory */
  relativePath: string
  content: string
}

export interface MigrationData {
  mcpServers: CanonicalMCPServer[]
  skills: SkillFile[]
}

/** Walk all files in a directory, returning relative paths and content */
async function readFilesFromDir(dir: string): Promise<SkillFile[]> {
  if (!await exists(dir))
    return []
  const files = await walkFiles(dir)
  const result: SkillFile[] = []
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    result.push({ relativePath: relative(dir, file), content })
  }
  return result
}

/** Read MCP config from a provider's config file */
async function readMCPConfig(provider: ProviderName, configPath: string): Promise<CanonicalMCPServer[]> {
  if (!await exists(configPath))
    return []
  const content = await fs.readFile(configPath, 'utf-8')
  return parseMCPFromProvider(provider, content)
}

/**
 * Convert skills from source format to target format.
 *
 * Structured → Structured: direct copy (same relative paths)
 * Structured → Flat: `<name>/SKILL.md` → `<name>.md`, references merged or dropped
 * Flat → Structured: `<name>.md` → `<name>/SKILL.md`
 * Flat → Flat: direct copy
 */
function convertSkills(
  skills: SkillFile[],
  sourceStructured: boolean,
  targetStructured: boolean,
): SkillFile[] {
  if (sourceStructured === targetStructured) {
    // Same format, direct copy
    return skills
  }

  if (sourceStructured && !targetStructured) {
    // Structured → Flat
    // SKILL.md → <dirname>.md, reference files → <dirname>/references/<file>
    // But for flat targets, we only take SKILL.md files and rename them
    const result: SkillFile[] = []
    for (const skill of skills) {
      const parts = skill.relativePath.split('/')
      if (parts.length === 2 && parts[1] === 'SKILL.md') {
        // <name>/SKILL.md → <name>.md
        result.push({ relativePath: `${parts[0]}.md`, content: skill.content })
      }
      // Skip reference files for flat targets — they can't be represented
      // in a flat directory structure meaningfully
    }
    return result
  }

  // Flat → Structured
  // <name>.md → <name>/SKILL.md
  const result: SkillFile[] = []
  for (const skill of skills) {
    const name = basename(skill.relativePath, '.md')
    result.push({ relativePath: join(name, 'SKILL.md'), content: skill.content })
  }
  return result
}

/**
 * Directories to exclude when reading skills.
 * These are provider-internal/system directories that should not be migrated.
 * e.g. codex `.system/` contains built-in skill-creator and skill-installer.
 */
function isSystemSkillPath(relativePath: string): boolean {
  // Exclude files under dot-prefixed top-level directories (e.g. .system/)
  return relativePath.startsWith('.')
    || relativePath.includes('/.') // nested hidden dirs
}

/**
 * Read migration data (MCP servers + skills) from a source provider.
 */
export async function readMigrationData(
  provider: ProviderName,
  scope: MigrationScope,
  projectRoot: string,
): Promise<MigrationData> {
  const mcpPath = getMCPConfigPath(provider, scope, projectRoot)
  const mcpServers = await readMCPConfig(provider, mcpPath)

  const skillsDir = getSkillsDir(provider, scope, projectRoot)
  const allSkills = await readFilesFromDir(skillsDir)
  // Filter out provider-internal system skills (e.g. codex .system/)
  const skills = allSkills.filter(s => !isSystemSkillPath(s.relativePath))

  // Claude Code also reads CLAUDE.md from project root (project scope only)
  if (provider === 'claude' && scope === 'project') {
    const claudeMdPath = join(projectRoot, 'CLAUDE.md')
    if (await exists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf-8')
      skills.unshift({ relativePath: 'CLAUDE.md', content })
    }
  }

  return { mcpServers, skills }
}

/**
 * Providers that support custom headers for URL transport servers.
 * Servers with headers migrated to unsupported providers will be skipped.
 */
const HEADERS_SUPPORTED_PROVIDERS = new Set<ProviderName>([
  'claude',
  'opencode',
  'codex',
  'gemini',
  'kiro',
  'cursor',
])

export interface PreparedMigrationResult {
  data: MigrationData
  /** URL transport servers skipped due to provider incompatibility */
  skippedServers: CanonicalMCPServer[]
}

/**
 * Prepare migration data for writing to a target provider.
 * Converts skills format between structured and flat as needed.
 * Filters out incompatible MCP servers (e.g. URL servers with headers
 * when target provider doesn't support custom headers).
 */
export function prepareMigrationData(
  data: MigrationData,
  fromProvider: ProviderName,
  fromScope: MigrationScope,
  toProvider: ProviderName,
  toScope: MigrationScope,
): PreparedMigrationResult {
  const sourceStructured = isStructuredSkills(fromProvider, fromScope)
  const targetStructured = isStructuredSkills(toProvider, toScope)
  const convertedSkills = convertSkills(data.skills, sourceStructured, targetStructured)

  // Filter out URL servers with headers when target doesn't support headers
  const skippedServers: CanonicalMCPServer[] = []
  let mcpServers = data.mcpServers
  if (!HEADERS_SUPPORTED_PROVIDERS.has(toProvider)) {
    mcpServers = data.mcpServers.filter((s) => {
      if (s.transport === 'url' && s.headers && Object.keys(s.headers).length > 0) {
        skippedServers.push(s)
        return false
      }
      return true
    })
  }

  return {
    data: { mcpServers, skills: convertedSkills },
    skippedServers,
  }
}

/**
 * Write migration data to a target provider.
 * Returns the list of file paths that were written.
 */
export async function writeMigrationData(
  provider: ProviderName,
  scope: MigrationScope,
  data: MigrationData,
  projectRoot: string,
): Promise<string[]> {
  const writtenPaths: string[] = []

  // Write MCP config
  if (data.mcpServers.length > 0) {
    const configPath = getMCPConfigPath(provider, scope, projectRoot)
    let existingConfig: Record<string, unknown> = {}

    // Preserve existing fields in the config file
    if (await exists(configPath)) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        existingConfig = provider === 'codex'
          ? parseTOML(content) as Record<string, unknown>
          : JSON.parse(content)
      }
      catch {
        existingConfig = {}
      }
    }

    // Build the servers object from canonical format and merge into existing config
    if (provider === 'opencode') {
      // OpenCode format: mcp.<name> = { type, command (array), environment }
      const mcpObj: Record<string, Record<string, unknown>> = {}
      for (const server of data.mcpServers) {
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
      const mcp = (existingConfig.mcp as Record<string, unknown>) || {}
      Object.assign(mcp, mcpObj)
      existingConfig.mcp = mcp
    }
    else if (provider === 'codex') {
      const serversObj: Record<string, Record<string, unknown>> = {}
      for (const server of data.mcpServers) {
        const entry: Record<string, unknown> = {}
        if (server.transport === 'url') {
          entry.url = server.url
          if (server.headers && Object.keys(server.headers).length > 0) {
            entry.http_headers = server.headers
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
      existingConfig.mcp_servers = serversObj
    }
    else {
      // Standard mcpServers format (claude, kiro, qoder, gemini, cursor)
      const serversObj: Record<string, Record<string, unknown>> = {}
      for (const server of data.mcpServers) {
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
            entry.headers = server.headers
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
      existingConfig.mcpServers = serversObj
    }

    await ensureParentDir(configPath)
    const output = provider === 'codex'
      ? stringifyTOML(existingConfig)
      : JSON.stringify(existingConfig, null, 2)
    await fs.writeFile(configPath, output, 'utf-8')
    writtenPaths.push(configPath)
  }

  // Write skills files
  if (data.skills.length > 0) {
    const skillsDir = getSkillsDir(provider, scope, projectRoot)
    for (const skill of data.skills) {
      const targetPath = join(skillsDir, skill.relativePath)
      await ensureParentDir(targetPath)
      await fs.writeFile(targetPath, skill.content, 'utf-8')
      writtenPaths.push(targetPath)
    }
  }

  return writtenPaths
}
