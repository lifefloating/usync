import type { ProviderName } from '../types.js'
import os from 'node:os'
import { join } from 'pathe'

export type MigrationScope = 'global' | 'project'

const home = os.homedir()

/** Get MCP config file path for a provider at the given scope */
export function getMCPConfigPath(provider: ProviderName, scope: MigrationScope, projectRoot: string): string {
  switch (provider) {
    case 'claudecode':
      return scope === 'global'
        ? join(home, '.claude', 'settings.json')
        : join(projectRoot, '.claude', 'settings.json')
    case 'kiro':
      return scope === 'global'
        ? join(home, '.kiro', 'settings', 'mcp.json')
        : join(projectRoot, '.kiro', 'settings', 'mcp.json')
    case 'opencode':
      return scope === 'global'
        ? join(home, '.config', 'opencode', 'opencode.json')
        : join(projectRoot, 'opencode.json')
    case 'codex':
      return scope === 'global'
        ? join(home, '.codex', 'config.toml')
        : join(projectRoot, '.codex', 'config.toml')
    case 'qoder':
      return scope === 'global'
        ? join(home, '.qoder.json')
        : join(projectRoot, '.mcp.json')
    case 'gemini-cli':
      return scope === 'global'
        ? join(home, '.gemini', 'settings.json')
        : join(projectRoot, '.gemini', 'settings.json')
  }
}

/**
 * Get the skills directory path for a provider at the given scope.
 *
 * Skills directory structures vary by provider and scope:
 * - claudecode: structured `<name>/SKILL.md` + `references/` at both scopes
 * - kiro global: structured `<name>/SKILL.md` + `references/`
 * - kiro project: flat `*.md` files in `.kiro/steering/`
 * - qoder: structured `<name>/SKILL.md` at both scopes
 * - opencode: structured `<name>/SKILL.md` at both scopes
 * - codex: structured `<name>/SKILL.md` + `reference/` at both scopes
 * - gemini-cli: flat files
 */
export function getSkillsDir(provider: ProviderName, scope: MigrationScope, projectRoot: string): string {
  switch (provider) {
    case 'claudecode':
      return scope === 'global'
        ? join(home, '.claude', 'skills')
        : join(projectRoot, '.claude', 'skills')
    case 'kiro':
      return scope === 'global'
        ? join(home, '.kiro', 'skills')
        : join(projectRoot, '.kiro', 'steering')
    case 'opencode':
      return scope === 'global'
        ? join(home, '.config', 'opencode', 'skills')
        : join(projectRoot, '.opencode', 'skills')
    case 'codex':
      return scope === 'global'
        ? join(home, '.codex', 'skills')
        : join(projectRoot, '.codex', 'skills')
    case 'qoder':
      return scope === 'global'
        ? join(home, '.qoder', 'skills')
        : join(projectRoot, '.qoder', 'skills')
    case 'gemini-cli':
      return scope === 'global'
        ? join(home, '.gemini', 'skills')
        : join(projectRoot, '.gemini', 'skills')
  }
}

/**
 * Whether a provider uses structured skills format at the given scope.
 * Structured = `<name>/SKILL.md` + optional `references/` subdirectory.
 * Flat = `*.md` files directly in the skills directory.
 */
export function isStructuredSkills(provider: ProviderName, scope: MigrationScope): boolean {
  if (provider === 'claudecode') return true
  if (provider === 'kiro' && scope === 'global') return true
  if (provider === 'qoder') return true
  if (provider === 'opencode') return true
  if (provider === 'codex') return true
  return false
}
