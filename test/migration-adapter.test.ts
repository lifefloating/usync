import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'node:fs/promises'
import { join } from 'pathe'
import { tmpdir } from 'node:os'
import { readMigrationData, writeMigrationData } from '../src/utils/migration-adapter.js'
import type { ProviderName } from '../src/types.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `usync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

const skillRelPathArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}\.md$/)

const markdownContentArb = fc.array(
  fc.oneof(
    fc.constant('# Heading\n'),
    fc.constant('Some text. '),
    fc.constant('- list item\n'),
    fc.constant('```code```\n'),
    fc.constant('\n'),
    fc.string({ minLength: 1, maxLength: 50 }),
  ),
  { minLength: 1, maxLength: 10 },
).map((parts) => parts.join(''))

describe('Migration Adapter - Skills content property tests', () => {
  /**
   * **Feature: tool-migration, Property 4: Skills 内容在迁移过程中保持不变**
   * **Validates: Requirements 4.7**
   */
  it.each(ALL_PROVIDERS)(
    'skills content is preserved through write/read cycle for provider: %s',
    async (provider) => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              relativePath: skillRelPathArb,
              content: markdownContentArb,
            }),
            { minLength: 1, maxLength: 3 },
          ).map((skills) => {
            const seen = new Set<string>()
            return skills.filter((s) => {
              if (seen.has(s.relativePath)) return false
              seen.add(s.relativePath)
              return true
            })
          }).filter((skills) => skills.length > 0),
          async (skills) => {
            const iterDir = join(testDir, `iter-${Math.random().toString(36).slice(2)}`)
            await fs.mkdir(iterDir, { recursive: true })

            await writeMigrationData(provider, 'project', { mcpServers: [], skills }, iterDir)
            const result = await readMigrationData(provider, 'project', iterDir)

            for (const original of skills) {
              const found = result.skills.find((s) => s.relativePath === original.relativePath)
              expect(found).toBeDefined()
              expect(found!.content).toBe(original.content)
            }
          },
        ),
        { numRuns: 50 },
      )
    },
  )
})


describe('readMigrationData - skills read paths (project scope)', () => {
  it('reads CLAUDE.md and .claude/skills/ for claude', async () => {
    const root = join(testDir, 'cc-read')
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(join(root, 'CLAUDE.md'), '# Claude Instructions', 'utf-8')
    await fs.mkdir(join(root, '.claude', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.claude', 'skills', 'skill1.md'), '# Skill 1', 'utf-8')

    const data = await readMigrationData('claude', 'project', root)
    expect(data.skills).toHaveLength(2)
    expect(data.skills[0]).toEqual({ relativePath: 'CLAUDE.md', content: '# Claude Instructions' })
    expect(data.skills[1]).toEqual({ relativePath: 'skill1.md', content: '# Skill 1' })
  })

  it('reads .kiro/steering/ for kiro', async () => {
    const root = join(testDir, 'kiro-read')
    await fs.mkdir(join(root, '.kiro', 'steering'), { recursive: true })
    await fs.writeFile(join(root, '.kiro', 'steering', 'guide.md'), '# Guide', 'utf-8')

    const data = await readMigrationData('kiro', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'guide.md', content: '# Guide' })
  })

  it('reads .opencode/skills/ for opencode', async () => {
    const root = join(testDir, 'oc-read')
    await fs.mkdir(join(root, '.opencode', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.opencode', 'skills', 'tips.md'), '# Tips', 'utf-8')

    const data = await readMigrationData('opencode', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'tips.md', content: '# Tips' })
  })

  it('reads .codex/skills/ for codex', async () => {
    const root = join(testDir, 'cx-read')
    await fs.mkdir(join(root, '.codex', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.codex', 'skills', 'rules.md'), '# Rules', 'utf-8')

    const data = await readMigrationData('codex', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'rules.md', content: '# Rules' })
  })

  it('reads .qoder/skills/ for qoder', async () => {
    const root = join(testDir, 'qo-read')
    await fs.mkdir(join(root, '.qoder', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.qoder', 'skills', 'prompt.md'), '# Prompt', 'utf-8')

    const data = await readMigrationData('qoder', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'prompt.md', content: '# Prompt' })
  })

  it('reads .gemini/skills/ for gemini', async () => {
    const root = join(testDir, 'gem-read')
    await fs.mkdir(join(root, '.gemini', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.gemini', 'skills', 'inst.md'), '# Instructions', 'utf-8')

    const data = await readMigrationData('gemini', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'inst.md', content: '# Instructions' })
  })

  it('reads .cursor/skills/ for cursor', async () => {
    const root = join(testDir, 'cur-read')
    await fs.mkdir(join(root, '.cursor', 'skills'), { recursive: true })
    await fs.writeFile(join(root, '.cursor', 'skills', 'style.md'), '# Style Guide', 'utf-8')

    const data = await readMigrationData('cursor', 'project', root)
    expect(data.skills).toHaveLength(1)
    expect(data.skills[0]).toEqual({ relativePath: 'style.md', content: '# Style Guide' })
  })

  it('returns empty skills when directory does not exist', async () => {
    const root = join(testDir, 'empty-read')
    await fs.mkdir(root, { recursive: true })

    const data = await readMigrationData('kiro', 'project', root)
    expect(data.skills).toEqual([])
  })
})

describe('readMigrationData - MCP config read (project scope)', () => {
  it('reads MCP from .mcp.json for claude', async () => {
    const root = join(testDir, 'cc-mcp')
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(join(root, '.mcp.json'), JSON.stringify({
      mcpServers: { 'test-server': { command: 'npx', args: ['--flag'] } },
    }), 'utf-8')

    const data = await readMigrationData('claude', 'project', root)
    expect(data.mcpServers).toHaveLength(1)
    expect(data.mcpServers[0].name).toBe('test-server')
    expect(data.mcpServers[0].command).toBe('npx')
  })

  it('reads MCP from opencode.json with mcp.<name> path for opencode', async () => {
    const root = join(testDir, 'oc-mcp')
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(join(root, 'opencode.json'), JSON.stringify({
      mcp: { 'oc-server': { type: 'local', command: ['node', 'srv.js'] } },
    }), 'utf-8')

    const data = await readMigrationData('opencode', 'project', root)
    expect(data.mcpServers).toHaveLength(1)
    expect(data.mcpServers[0].name).toBe('oc-server')
  })

  it('returns empty MCP when config file does not exist', async () => {
    const root = join(testDir, 'no-mcp')
    await fs.mkdir(root, { recursive: true })

    const data = await readMigrationData('codex', 'project', root)
    expect(data.mcpServers).toEqual([])
  })
})

describe('writeMigrationData - skills write paths (project scope)', () => {
  const sampleSkills = [{ relativePath: 'test.md', content: '# Test Content' }]

  it('writes skills to .claude/skills/ for claude', async () => {
    const root = join(testDir, 'cc-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('claude', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.claude', 'skills', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })

  it('writes skills to .kiro/steering/ for kiro', async () => {
    const root = join(testDir, 'kiro-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('kiro', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.kiro', 'steering', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })

  it('writes skills to .opencode/skills/ for opencode', async () => {
    const root = join(testDir, 'oc-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('opencode', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.opencode', 'skills', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })

  it('writes skills to .qoder/skills/ for qoder', async () => {
    const root = join(testDir, 'qo-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('qoder', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.qoder', 'skills', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })

  it('writes skills to .gemini/skills/ for gemini', async () => {
    const root = join(testDir, 'gem-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('gemini', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.gemini', 'skills', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })

  it('writes skills to .cursor/skills/ for cursor', async () => {
    const root = join(testDir, 'cur-write')
    await fs.mkdir(root, { recursive: true })

    await writeMigrationData('cursor', 'project', { mcpServers: [], skills: sampleSkills }, root)
    const content = await fs.readFile(join(root, '.cursor', 'skills', 'test.md'), 'utf-8')
    expect(content).toBe('# Test Content')
  })
})
