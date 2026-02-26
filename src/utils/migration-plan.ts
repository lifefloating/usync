import type { ProviderName } from '../types.js'
import type { MigrationData } from './migration-adapter.js'
import type { MigrationScope } from './migration-paths.js'
import { join } from 'pathe'
import { exists } from './fs.js'
import { writeMigrationData } from './migration-adapter.js'
import { getMCPConfigPath, getSkillsDir } from './migration-paths.js'

export type MigrationAction = 'create' | 'skip' | 'conflict'

export interface MigrationPlanItem {
  targetPath: string
  action: MigrationAction
  description: string
}

export interface MigrationPlan {
  from: ProviderName
  to: ProviderName
  scope: MigrationScope
  items: MigrationPlanItem[]
}

/**
 * Build a migration plan by checking which target paths already exist.
 * Files that exist are marked as 'conflict', new files as 'create'.
 */
export async function buildMigrationPlan(
  from: ProviderName,
  to: ProviderName,
  scope: MigrationScope,
  data: MigrationData,
  projectRoot: string,
): Promise<MigrationPlan> {
  const items: MigrationPlanItem[] = []

  // Plan MCP config write
  if (data.mcpServers.length > 0) {
    const configPath = getMCPConfigPath(to, scope, projectRoot)
    const fileExists = await exists(configPath)
    items.push({
      targetPath: configPath,
      action: fileExists ? 'conflict' : 'create',
      description: fileExists
        ? `MCP config already exists at ${configPath} (will overwrite)`
        : `Create MCP config at ${configPath}`,
    })
  }

  // Plan skills writes
  if (data.skills.length > 0) {
    const skillsDir = getSkillsDir(to, scope, projectRoot)
    for (const skill of data.skills) {
      const targetPath = join(skillsDir, skill.relativePath)
      const fileExists = await exists(targetPath)
      items.push({
        targetPath,
        action: fileExists ? 'conflict' : 'create',
        description: fileExists
          ? `Skill file already exists at ${targetPath} (will overwrite)`
          : `Create skill file at ${targetPath}`,
      })
    }
  }

  return { from, to, scope, items }
}

/**
 * Execute a migration plan: write files for items not marked as 'skip'.
 * Filters the migration data to exclude skipped items, then delegates to writeMigrationData.
 */
export async function executeMigrationPlan(
  plan: MigrationPlan,
  data: MigrationData,
  projectRoot: string,
): Promise<void> {
  const { to, scope } = plan
  const skippedPaths = new Set(
    plan.items.filter(i => i.action === 'skip').map(i => i.targetPath),
  )

  // Filter MCP servers if the MCP config path is skipped
  const mcpConfigPath = data.mcpServers.length > 0 ? getMCPConfigPath(to, scope, projectRoot) : null
  const filteredMCP = mcpConfigPath && skippedPaths.has(mcpConfigPath)
    ? []
    : data.mcpServers

  // Filter skills whose target path is skipped
  const skillsDir = getSkillsDir(to, scope, projectRoot)
  const filteredSkills = data.skills.filter((skill) => {
    const targetPath = join(skillsDir, skill.relativePath)
    return !skippedPaths.has(targetPath)
  })

  const filteredData: MigrationData = {
    mcpServers: filteredMCP,
    skills: filteredSkills,
  }

  await writeMigrationData(to, scope, filteredData, projectRoot)
}
