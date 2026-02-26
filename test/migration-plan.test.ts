import type { ProviderName } from '../src/types.js'
import type { CanonicalMCPServer } from '../src/utils/mcp.js'
import type { MigrationData, SkillFile } from '../src/utils/migration-adapter.js'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import fc from 'fast-check'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildMigrationPlan, executeMigrationPlan } from '../src/utils/migration-plan.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `usync-plan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

/** Map provider to its project-level skills directory relative path */
function skillsDirRel(provider: ProviderName): string {
  switch (provider) {
    case 'claude': return '.claude/skills'
    case 'kiro': return '.kiro/steering'
    case 'opencode': return '.opencode/skills'
    case 'codex': return '.codex/skills'
    case 'qoder': return '.qoder/skills'
    case 'gemini': return '.gemini/skills'
    case 'cursor': return '.cursor/skills'
  }
}

const skillNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}\.md$/)

describe('migration Plan - conflict detection property tests', () => {
  /**
   * **Feature: tool-migration, Property 5: 已存在的目标文件在 Migration Plan 中标记为冲突**
   * **Validates: Requirements 4.8**
   */
  it.each(ALL_PROVIDERS)(
    'existing target files are marked as conflict for provider: %s',
    async (provider) => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: skillNameArb,
              preExist: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 },
          ).map((items) => {
            const seen = new Set<string>()
            return items.filter((i) => {
              if (seen.has(i.name))
                return false
              seen.add(i.name)
              return true
            })
          }).filter(items => items.length > 0),
          async (items) => {
            const iterDir = join(testDir, `iter-${Math.random().toString(36).slice(2)}`)
            await fs.mkdir(iterDir, { recursive: true })

            const skillsDir = join(iterDir, skillsDirRel(provider))
            for (const item of items) {
              if (item.preExist) {
                await fs.mkdir(skillsDir, { recursive: true })
                await fs.writeFile(join(skillsDir, item.name), 'existing', 'utf-8')
              }
            }

            const data: MigrationData = {
              mcpServers: [],
              skills: items.map(i => ({ relativePath: i.name, content: '# New' })),
            }

            const plan = await buildMigrationPlan('claude', provider, 'project', data, iterDir)

            for (const item of items) {
              const targetPath = join(skillsDir, item.name)
              const planItem = plan.items.find(p => p.targetPath === targetPath)
              expect(planItem).toBeDefined()
              if (item.preExist) {
                expect(planItem!.action).toBe('conflict')
              }
              else {
                expect(planItem!.action).toBe('create')
              }
            }
          },
        ),
        { numRuns: 50 },
      )
    },
  )
})

describe('buildMigrationPlan - unit tests', () => {
  it('returns empty plan for empty migration data', async () => {
    const root = join(testDir, 'empty-plan')
    await fs.mkdir(root, { recursive: true })

    const plan = await buildMigrationPlan('claude', 'kiro', 'project', { mcpServers: [], skills: [] }, root)
    expect(plan.from).toBe('claude')
    expect(plan.to).toBe('kiro')
    expect(plan.scope).toBe('project')
    expect(plan.items).toEqual([])
  })

  it('marks new MCP config as create', async () => {
    const root = join(testDir, 'new-mcp')
    await fs.mkdir(root, { recursive: true })

    const data: MigrationData = {
      mcpServers: [{ name: 'srv', transport: 'stdio', command: 'cmd', args: [] }],
      skills: [],
    }
    const plan = await buildMigrationPlan('claude', 'kiro', 'project', data, root)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].action).toBe('create')
  })

  it('marks existing MCP config as conflict', async () => {
    const root = join(testDir, 'exist-mcp')
    await fs.mkdir(join(root, '.kiro', 'settings'), { recursive: true })
    await fs.writeFile(join(root, '.kiro', 'settings', 'mcp.json'), '{}', 'utf-8')

    const data: MigrationData = {
      mcpServers: [{ name: 'srv', transport: 'stdio', command: 'cmd', args: [] }],
      skills: [],
    }
    const plan = await buildMigrationPlan('claude', 'kiro', 'project', data, root)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].action).toBe('conflict')
  })

  it('handles mixed create and conflict for skills', async () => {
    const root = join(testDir, 'mixed')
    await fs.mkdir(join(root, '.kiro', 'steering'), { recursive: true })
    await fs.writeFile(join(root, '.kiro', 'steering', 'existing.md'), 'old', 'utf-8')

    const data: MigrationData = {
      mcpServers: [],
      skills: [
        { relativePath: 'existing.md', content: 'new' },
        { relativePath: 'brand-new.md', content: 'fresh' },
      ],
    }
    const plan = await buildMigrationPlan('claude', 'kiro', 'project', data, root)
    expect(plan.items).toHaveLength(2)

    const existingItem = plan.items.find(i => i.targetPath.includes('existing.md'))
    const newItem = plan.items.find(i => i.targetPath.includes('brand-new.md'))
    expect(existingItem!.action).toBe('conflict')
    expect(newItem!.action).toBe('create')
  })
})

describe('executeMigrationPlan - unit tests', () => {
  it('writes files for create actions', async () => {
    const root = join(testDir, 'exec-create')
    await fs.mkdir(root, { recursive: true })

    const data: MigrationData = {
      mcpServers: [],
      skills: [{ relativePath: 'new-skill.md', content: '# New Skill' }],
    }
    const plan = await buildMigrationPlan('claude', 'kiro', 'project', data, root)
    await executeMigrationPlan(plan, data, root)

    const content = await fs.readFile(join(root, '.kiro', 'steering', 'new-skill.md'), 'utf-8')
    expect(content).toBe('# New Skill')
  })

  it('skips files marked as skip', async () => {
    const root = join(testDir, 'exec-skip')
    await fs.mkdir(join(root, '.kiro', 'steering'), { recursive: true })
    await fs.writeFile(join(root, '.kiro', 'steering', 'keep.md'), 'original', 'utf-8')

    const data: MigrationData = {
      mcpServers: [],
      skills: [{ relativePath: 'keep.md', content: 'overwritten' }],
    }
    const plan = await buildMigrationPlan('claude', 'kiro', 'project', data, root)
    plan.items[0].action = 'skip'
    await executeMigrationPlan(plan, data, root)

    const content = await fs.readFile(join(root, '.kiro', 'steering', 'keep.md'), 'utf-8')
    expect(content).toBe('original')
  })
})

// ============================================================
// Generators for dry-run property test
// ============================================================

const serverNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/)
// eslint-disable-next-line regexp/use-ignore-case
const commandArb = fc.stringMatching(/^[a-zA-Z][\w./-]{0,29}$/)
const argArb = fc.stringMatching(/^[\w@./:=-]{1,30}$/)
const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,19}$/)
const envValueArb = fc.stringMatching(/^[\w./-]{1,30}$/)

const envArb = fc.oneof(
  fc.constant(undefined),
  fc.dictionary(envKeyArb, envValueArb, { minKeys: 1, maxKeys: 3 }),
)

const mcpServerArb: fc.Arbitrary<CanonicalMCPServer> = fc.record({
  name: serverNameArb,
  transport: fc.constant('stdio' as const),
  command: commandArb,
  args: fc.array(argArb, { minLength: 0, maxLength: 3 }),
  env: envArb,
})

const skillFileArb: fc.Arbitrary<SkillFile> = fc.record({
  relativePath: skillNameArb,
  content: fc.string({ minLength: 1, maxLength: 100 }),
})

const migrationDataArb: fc.Arbitrary<MigrationData> = fc.record({
  mcpServers: fc.array(mcpServerArb, { minLength: 0, maxLength: 3 }).map((servers) => {
    const seen = new Set<string>()
    return servers.filter((s) => {
      if (seen.has(s.name))
        return false
      seen.add(s.name)
      return true
    })
  }),
  skills: fc.array(skillFileArb, { minLength: 0, maxLength: 3 }).map((skills) => {
    const seen = new Set<string>()
    return skills.filter((s) => {
      if (seen.has(s.relativePath))
        return false
      seen.add(s.relativePath)
      return true
    })
  }),
})

async function listAllFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...await listAllFiles(fullPath))
      }
      else if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  }
  catch {
    // directory doesn't exist
  }
  return results.sort()
}

describe('migration Plan - dry-run property tests', () => {
  /**
   * **Feature: tool-migration, Property 6: Dry-run 模式不产生文件写入**
   * **Validates: Requirements 5.6**
   */
  it.each(ALL_PROVIDERS)(
    'buildMigrationPlan does not write any files for provider: %s',
    async (provider) => {
      await fc.assert(
        fc.asyncProperty(
          migrationDataArb,
          fc.constantFrom(...ALL_PROVIDERS),
          async (data, sourceProvider) => {
            const iterDir = join(testDir, `dryrun-${Math.random().toString(36).slice(2)}`)
            await fs.mkdir(iterDir, { recursive: true })

            const filesBefore = await listAllFiles(iterDir)
            const plan = await buildMigrationPlan(sourceProvider, provider, 'project', data, iterDir)
            const filesAfter = await listAllFiles(iterDir)

            expect(plan).toBeDefined()
            expect(plan.from).toBe(sourceProvider)
            expect(plan.to).toBe(provider)
            expect(filesAfter).toEqual(filesBefore)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})
