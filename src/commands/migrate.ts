import type { ProviderName } from '../types.js'
import type { MigrationScope } from '../utils/migration-paths.js'
import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan, gray, green, yellow } from 'colorette'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { prepareMigrationData, readMigrationData } from '../utils/migration-adapter.js'
import { buildMigrationPlan, executeMigrationPlan } from '../utils/migration-plan.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']
const ALL_SCOPES: MigrationScope[] = ['global', 'project']

function isValidProvider(value: string): value is ProviderName {
  return ALL_PROVIDERS.includes(value as ProviderName)
}

function isValidScope(value: string): value is MigrationScope {
  return ALL_SCOPES.includes(value as MigrationScope)
}

export default defineCommand({
  meta: {
    description: 'Migrate MCP configs and skills between AI coding tools',
  },
  args: {
    'from': { type: 'string', alias: 'f', description: 'Source provider' },
    'to': { type: 'string', alias: 't', description: 'Target provider' },
    'scope': { type: 'string', alias: 's', description: 'Migration scope: global or project' },
    'cwd': { type: 'string', alias: 'C', description: 'Project root directory (for project scope)' },
    'dry-run': { type: 'boolean', alias: 'n', default: false, description: 'Preview changes without writing' },
    'overwrite': { type: 'boolean', alias: 'w', default: false, description: 'Overwrite existing files (default: skip conflicts)' },
    'yes': { type: 'boolean', alias: 'y', default: false, description: 'Skip confirmation prompts' },
  },
  async run({ args }) {
    p.intro(cyan('usync migrate'))

    const projectRoot = resolve(args.cwd ?? process.cwd())

    // Resolve --scope (default: global, interactive only if not provided)
    let scope: MigrationScope
    if (args.scope) {
      if (!isValidScope(args.scope)) {
        consola.error(`Invalid scope: ${args.scope}. Valid scopes: ${ALL_SCOPES.join(', ')}`)
        process.exitCode = 1
        return
      }
      scope = args.scope
    }
    else {
      scope = 'global'
    }

    // Resolve --from (interactive if missing)
    let from: ProviderName
    if (args.from) {
      if (!isValidProvider(args.from)) {
        consola.error(`Invalid source provider: ${args.from}. Valid providers: ${ALL_PROVIDERS.join(', ')}`)
        process.exitCode = 1
        return
      }
      from = args.from
    }
    else {
      const selected = await p.select({
        message: 'Select source provider',
        options: ALL_PROVIDERS.map(name => ({ value: name, label: name })),
      })
      if (p.isCancel(selected)) {
        p.cancel('Migration cancelled.')
        process.exitCode = 0
        return
      }
      from = selected
    }

    // Resolve --to (interactive if missing)
    let to: ProviderName
    if (args.to) {
      if (!isValidProvider(args.to)) {
        consola.error(`Invalid target provider: ${args.to}. Valid providers: ${ALL_PROVIDERS.join(', ')}`)
        process.exitCode = 1
        return
      }
      to = args.to
    }
    else {
      const selected = await p.select({
        message: 'Select target provider',
        options: ALL_PROVIDERS.map(name => ({ value: name, label: name })),
      })
      if (p.isCancel(selected)) {
        p.cancel('Migration cancelled.')
        process.exitCode = 0
        return
      }
      to = selected
    }

    // Validate from !== to
    if (from === to) {
      consola.error('Source and target provider cannot be the same.')
      process.exitCode = 1
      return
    }

    consola.info(`Migrating from ${cyan(from)} to ${cyan(to)} (${scope})`)
    if (scope === 'project') {
      consola.info(`Project root: ${gray(projectRoot)}`)
    }

    // Read source data
    const s = p.spinner()
    s.start('Reading source data...')

    let data: Awaited<ReturnType<typeof readMigrationData>>
    try {
      data = await readMigrationData(from, scope, projectRoot)
    }
    catch (error) {
      s.stop('Failed to read source data')
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }
    s.stop('Source data loaded')

    // Check if source data is empty
    if (data.mcpServers.length === 0 && data.skills.length === 0) {
      consola.warn(`No MCP configs or skills found for ${from} (${scope}). Nothing to migrate.`)
      p.outro('Done!')
      return
    }

    consola.info(`Found ${data.mcpServers.length} MCP server(s) and ${data.skills.length} skill file(s)`)

    // Convert skills format for target provider, filter incompatible servers
    const { data: preparedData, skippedServers } = prepareMigrationData(data, from, scope, to, scope)

    if (skippedServers.length > 0) {
      for (const s of skippedServers) {
        consola.warn(`Skipping MCP server "${s.name}" — requires auth headers but ${to} does not support custom headers for URL transport`)
      }
    }

    // Build migration plan
    s.start('Building migration plan...')
    let plan: Awaited<ReturnType<typeof buildMigrationPlan>>
    try {
      plan = await buildMigrationPlan(from, to, scope, preparedData, projectRoot)
    }
    catch (error) {
      s.stop('Failed to build migration plan')
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }
    s.stop('Migration plan ready')

    // Display preview
    consola.log('')
    consola.log(cyan('  Migration Plan:'))
    for (const item of plan.items) {
      if (item.action === 'create') {
        consola.log(`    ${green('+')} ${item.description}`)
      }
      else if (item.action === 'conflict') {
        consola.log(`    ${yellow('!')} ${item.description}`)
      }
      else if (item.action === 'skip') {
        consola.log(`    ${gray('-')} ${item.description}`)
      }
    }
    consola.log('')

    // Dry-run: stop here
    if (args['dry-run']) {
      consola.info('Dry-run mode: no files were written.')
      p.outro('Done!')
      return
    }

    // Resolve conflicts
    const conflicts = plan.items.filter(i => i.action === 'conflict')
    if (conflicts.length > 0) {
      if (args.overwrite) {
        // --overwrite: keep all conflicts as 'conflict' (will overwrite)
      }
      else if (args.yes) {
        // --yes without --overwrite: skip all conflicts (safe default)
        for (const item of conflicts) {
          item.action = 'skip'
        }
      }
      else {
        // Interactive: ask user per conflict
        const overwriteAll = await p.confirm({
          message: `${conflicts.length} file(s) already exist. Overwrite all?`,
        })
        if (p.isCancel(overwriteAll)) {
          p.cancel('Migration cancelled.')
          process.exitCode = 0
          return
        }
        if (!overwriteAll) {
          for (const item of conflicts) {
            const overwrite = await p.confirm({
              message: `Overwrite ${item.targetPath}?`,
            })
            if (p.isCancel(overwrite)) {
              p.cancel('Migration cancelled.')
              process.exitCode = 0
              return
            }
            if (!overwrite) {
              item.action = 'skip'
            }
          }
        }
      }
    }

    // Confirm execution
    if (!args.yes) {
      const confirmed = await p.confirm({ message: 'Apply migration?' })
      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Migration cancelled.')
        process.exitCode = 0
        return
      }
    }

    // Execute
    s.start('Applying migration...')
    try {
      await executeMigrationPlan(plan, preparedData, projectRoot)
    }
    catch (error) {
      s.stop('Migration failed')
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }
    s.stop('Migration complete')

    const created = plan.items.filter(i => i.action === 'create').length
    const overwritten = plan.items.filter(i => i.action === 'conflict').length
    const skipped = plan.items.filter(i => i.action === 'skip').length

    if (created > 0)
      consola.log(`  ${green(`Created: ${created}`)}`)
    if (overwritten > 0)
      consola.log(`  ${yellow(`Overwritten: ${overwritten}`)}`)
    if (skipped > 0)
      consola.log(`  ${gray(`Skipped: ${skipped}`)}`)

    p.outro('Done!')
  },
})
