import type { ProviderName } from '../types.js'
import os from 'node:os'
import { join } from 'pathe'

export type MigrationScope = 'global' | 'project'

const home = os.homedir()

/**
 * Get MCP config file path for a provider at the given scope.
 *
 * Paths verified against official documentation:
 * - claudecode: ~/.claude.json (user scope) | .mcp.json (project scope)
 * - kiro: ~/.kiro/settings/mcp.json | .kiro/settings/mcp.json
 * - opencode: ~/.config/opencode/opencode.json | opencode.json
 * - codex: ~/.codex/config.toml | .codex/config.toml
 * - qoder: MCP configured via IDE settings (mcpServers format)
 * - gemini-cli: ~/.gemini/settings.json | .gemini/settings.json
 * - cursor: ~/.cursor/mcp.json | .cursor/mcp.json
 */
export function getMCPConfigPath(provider: ProviderName, scope: MigrationScope, projectRoot: string): string {
  switch (provider) {
    case 'claudecode':
      // Official docs: user scope → ~/.claude.json, project scope → .mcp.json
      return scope === 'global'
        ? join(home, '.claude.json')
        : join(projectRoot, '.mcp.json')
    case 'kiro':
      return scope === 'global'
        ? join(home, '.kiro', 'settings', 'mcp.json')
        : join(projectRoot, '.kiro', 'settings', 'mcp.json')
    case 'opencode':
      // Official docs: global → ~/.config/opencode/opencode.json, project → opencode.json
      return scope === 'global'
        ? join(home, '.config', 'opencode', 'opencode.json')
        : join(projectRoot, 'opencode.json')
    case 'codex':
      // Official docs: global → ~/.codex/config.toml, project → .codex/config.toml
      return scope === 'global'
        ? join(home, '.codex', 'config.toml')
        : join(projectRoot, '.codex', 'config.toml')
    case 'qoder':
      // Qoder IDE manages MCP via settings UI; CLI uses ~/.qoder/mcp.json convention
      return scope === 'global'
        ? join(home, '.qoder', 'mcp.json')
        : join(projectRoot, '.qoder', 'mcp.json')
    case 'gemini-cli':
      // Official docs: global → ~/.gemini/settings.json, project → .gemini/settings.json
      return scope === 'global'
        ? join(home, '.gemini', 'settings.json')
        : join(projectRoot, '.gemini', 'settings.json')
    case 'cursor':
      // Official docs: global → ~/.cursor/mcp.json, project → .cursor/mcp.json
      return scope === 'global'
        ? join(home, '.cursor', 'mcp.json')
        : join(projectRoot, '.cursor', 'mcp.json')
  }
}

/**
 * Get the skills directory path for a provider at the given scope.
 *
 * Paths verified against official documentation:
 * - claudecode: ~/.claude/skills | .claude/skills (structured SKILL.md)
 * - kiro global: ~/.kiro/skills (structured) | .kiro/steering (flat)
 * - opencode: ~/.config/opencode/skills | .opencode/skills (structured SKILL.md)
 * - codex: no structured skills dir; uses AGENTS.md / instructions.md
 * - qoder: ~/.qoder/skills | .qoder/skills (structured SKILL.md)
 * - gemini-cli: uses GEMINI.md files, no structured skills dir
 * - cursor: no global skills; .cursor/rules (flat .md/.mdc files)
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
      // Codex doesn't have a structured skills directory
      // Global: ~/.codex/instructions.md (single file)
      // Project: AGENTS.md at project root
      // We use a placeholder dir for migration compatibility
      return scope === 'global'
        ? join(home, '.codex', 'skills')
        : join(projectRoot, '.codex', 'skills')
    case 'qoder':
      return scope === 'global'
        ? join(home, '.qoder', 'skills')
        : join(projectRoot, '.qoder', 'skills')
    case 'gemini-cli':
      // Gemini CLI uses GEMINI.md files, not structured skills
      // We use a placeholder dir for migration compatibility
      return scope === 'global'
        ? join(home, '.gemini', 'skills')
        : join(projectRoot, '.gemini', 'skills')
    case 'cursor':
      // Cursor: no global skills; project uses .cursor/rules/
      return scope === 'global'
        ? join(home, '.cursor', 'rules')
        : join(projectRoot, '.cursor', 'rules')
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
  // cursor, gemini-cli, kiro project → flat
  return false
}
