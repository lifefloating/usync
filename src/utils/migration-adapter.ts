import type { ProviderName } from '../types.js'
import type { CanonicalMCPServer } from './mcp.js'
import type { MigrationScope } from './migration-paths.js'
import fs from 'node:fs/promises'
import { basename, join, relative } from 'pathe'
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml'
import { exists, walkFiles, ensureParentDir } from './fs.js'
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
  if (!await exists(dir)) return []
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
  if (!await exists(configPath)) return []
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
  const skills = await readFilesFromDir(skillsDir)

  // Claude Code also reads CLAUDE.md from project root (project scope only)
  if (provider === 'claudecode' && scope === 'project') {
    const claudeMdPath = join(projectRoot, 'CLAUDE.md')
    if (await exists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf-8')
      skills.unshift({ relativePath: 'CLAUDE.md', content })
    }
  }

  return { mcpServers, skills }
}

/**
 * Prepare migration data for writing to a target provider.
 * Converts skills format between structured and flat as needed.
 */
export function prepareMigrationData(
  data: MigrationData,
  fromProvider: ProviderName,
  fromScope: MigrationScope,
  toProvider: ProviderName,
  toScope: MigrationScope,
): MigrationData {
  const sourceStructured = isStructuredSkills(fromProvider, fromScope)
  const targetStructured = isStructuredSkills(toProvider, toScope)
  const convertedSkills = convertSkills(data.skills, sourceStructured, targetStructured)
  return { mcpServers: data.mcpServers, skills: convertedSkills }
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

    // Build the servers object from canonical format
    const serversObj: Record<string, Record<string, unknown>> = {}
    for (const server of data.mcpServers) {
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

    // Merge into existing config
    if (provider === 'opencode') {
      const mcp = (existingConfig.mcp as Record<string, unknown>) || {}
      mcp.servers = serversObj
      existingConfig.mcp = mcp
    }
    else if (provider === 'codex') {
      existingConfig.mcp_servers = serversObj
    }
    else {
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
