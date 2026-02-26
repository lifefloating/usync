import type { ProviderName } from '../src/types.js'
import type { CanonicalMCPServer } from '../src/utils/mcp.js'
import type { MigrationData, SkillFile } from '../src/utils/migration-adapter.js'
import type { MigrationScope } from '../src/utils/migration-paths.js'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { parse as parseTOML } from 'smol-toml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseMCPFromProvider, serializeMCPForProvider } from '../src/utils/mcp.js'
import { prepareMigrationData, readMigrationData, writeMigrationData } from '../src/utils/migration-adapter.js'
import { getMCPConfigPath, getSkillsDir, isStructuredSkills } from '../src/utils/migration-paths.js'
import { buildMigrationPlan, executeMigrationPlan } from '../src/utils/migration-plan.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']
const ALL_SCOPES: MigrationScope[] = ['global', 'project']

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `usync-cross-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

// ============================================================
// Shared test data
// ============================================================

const SAMPLE_SERVERS: CanonicalMCPServer[] = [
  { name: 'filesystem', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'], env: { NODE_ENV: 'production' } },
  { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: 'ghp_test123' } },
  { name: 'simple', transport: 'stdio', command: 'node', args: ['server.js'] },
]

const SAMPLE_URL_SERVER: CanonicalMCPServer = {
  name: 'remote-api',
  transport: 'url',
  url: 'https://mcp.example.com/v1',
}

const STRUCTURED_SKILLS: SkillFile[] = [
  { relativePath: 'coding-standards/SKILL.md', content: '# Coding Standards\nFollow these rules...' },
  { relativePath: 'coding-standards/references/eslint.md', content: '# ESLint Config\nUse strict mode.' },
  { relativePath: 'coding-standards/references/prettier.md', content: '# Prettier\nUse 2-space indent.' },
  { relativePath: 'testing/SKILL.md', content: '# Testing Guide\nWrite unit tests for all functions.' },
  { relativePath: 'testing/references/vitest.md', content: '# Vitest Setup\nUse vitest for testing.' },
]

const FLAT_SKILLS: SkillFile[] = [
  { relativePath: 'coding-standards.md', content: '# Coding Standards\nFollow these rules...' },
  { relativePath: 'testing.md', content: '# Testing Guide\nWrite unit tests for all functions.' },
  { relativePath: 'deployment.md', content: '# Deployment\nUse CI/CD pipeline.' },
]

// ============================================================
// 1. MCP config path correctness for every provider × scope
// ============================================================

describe('getMCPConfigPath - correctness for all provider × scope combinations', () => {
  const projectRoot = '/test/project'

  const expected: Record<string, Record<MigrationScope, string>> = {
    claude: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.claude.json'),
      project: join(projectRoot, '.mcp.json'),
    },
    kiro: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.kiro', 'settings', 'mcp.json'),
      project: join(projectRoot, '.kiro', 'settings', 'mcp.json'),
    },
    opencode: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'opencode', 'opencode.json'),
      project: join(projectRoot, 'opencode.json'),
    },
    codex: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.codex', 'config.toml'),
      project: join(projectRoot, '.codex', 'config.toml'),
    },
    qoder: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.qoder', 'mcp.json'),
      project: join(projectRoot, '.qoder', 'mcp.json'),
    },
    gemini: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.gemini', 'settings.json'),
      project: join(projectRoot, '.gemini', 'settings.json'),
    },
    cursor: {
      global: join(process.env.HOME || process.env.USERPROFILE || '', '.cursor', 'mcp.json'),
      project: join(projectRoot, '.cursor', 'mcp.json'),
    },
  }

  for (const provider of ALL_PROVIDERS) {
    for (const scope of ALL_SCOPES) {
      it(`${provider} / ${scope}`, () => {
        const result = getMCPConfigPath(provider, scope, projectRoot)
        expect(result).toBe(expected[provider][scope])
      })
    }
  }
})

// ============================================================
// 2. Skills directory path correctness for every provider × scope
// ============================================================

describe('getSkillsDir - correctness for all provider × scope combinations', () => {
  const projectRoot = '/test/project'
  const home = process.env.HOME || process.env.USERPROFILE || ''

  const expected: Record<string, Record<MigrationScope, string>> = {
    claude: {
      global: join(home, '.claude', 'skills'),
      project: join(projectRoot, '.claude', 'skills'),
    },
    kiro: {
      global: join(home, '.kiro', 'skills'),
      project: join(projectRoot, '.kiro', 'steering'),
    },
    opencode: {
      global: join(home, '.config', 'opencode', 'skills'),
      project: join(projectRoot, '.opencode', 'skills'),
    },
    codex: {
      global: join(home, '.codex', 'skills'),
      project: join(projectRoot, '.codex', 'skills'),
    },
    qoder: {
      global: join(home, '.qoder', 'skills'),
      project: join(projectRoot, '.qoder', 'skills'),
    },
    gemini: {
      global: join(home, '.gemini', 'skills'),
      project: join(projectRoot, '.gemini', 'skills'),
    },
    cursor: {
      global: join(home, '.cursor', 'skills'),
      project: join(projectRoot, '.cursor', 'skills'),
    },
  }

  for (const provider of ALL_PROVIDERS) {
    for (const scope of ALL_SCOPES) {
      it(`${provider} / ${scope}`, () => {
        const result = getSkillsDir(provider, scope, projectRoot)
        expect(result).toBe(expected[provider][scope])
      })
    }
  }
})

// ============================================================
// 3. isStructuredSkills correctness for every provider × scope
// ============================================================

describe('isStructuredSkills - correctness for all provider × scope combinations', () => {
  const expected: Record<string, Record<MigrationScope, boolean>> = {
    claude: { global: true, project: true },
    kiro: { global: true, project: false },
    opencode: { global: true, project: true },
    codex: { global: true, project: true },
    qoder: { global: true, project: true },
    gemini: { global: true, project: true },
    cursor: { global: true, project: true },
  }

  for (const provider of ALL_PROVIDERS) {
    for (const scope of ALL_SCOPES) {
      it(`${provider} / ${scope} →${expected[provider][scope]}`, () => {
        expect(isStructuredSkills(provider, scope)).toBe(expected[provider][scope])
      })
    }
  }
})

// ============================================================
// 4. Cross-tool MCP migration end-to-end tests
//    Write MCP to source →read →write to target →read back →verify
// ============================================================

describe('cross-tool MCP migration end-to-end', () => {
  /** Key migration pairs covering all format variations */
  const MIGRATION_PAIRS: [ProviderName, ProviderName][] = [
    // Standard JSON mcpServers →Standard JSON mcpServers
    ['claude', 'kiro'],
    ['kiro', 'claude'],
    ['claude', 'cursor'],
    ['cursor', 'claude'],
    ['kiro', 'qoder'],
    ['qoder', 'kiro'],
    ['gemini', 'kiro'],
    // Standard JSON mcpServers →OpenCode (mcp.<name> with command array)
    ['claude', 'opencode'],
    ['opencode', 'kiro'],
    ['opencode', 'claude'],
    ['cursor', 'opencode'],
    // Standard JSON mcpServers →Codex (TOML mcp_servers)
    ['claude', 'codex'],
    ['codex', 'kiro'],
    ['codex', 'claude'],
    ['cursor', 'codex'],
    // OpenCode →Codex (both non-standard formats)
    ['opencode', 'codex'],
    ['codex', 'opencode'],
  ]

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

  for (const [from, to] of MIGRATION_PAIRS) {
    it(`${from} →${to}: MCP servers survive full write→read→write→read cycle`, async () => {
      const srcRoot = join(testDir, `mcp-${from}-${to}-src`)
      const dstRoot = join(testDir, `mcp-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      // Step 1: Write MCP config to source provider
      const sourceData: MigrationData = { mcpServers: SAMPLE_SERVERS, skills: [] }
      await writeMigrationData(from, 'project', sourceData, srcRoot)

      // Step 2: Read from source
      const readFromSource = await readMigrationData(from, 'project', srcRoot)
      expect(readFromSource.mcpServers.length).toBe(SAMPLE_SERVERS.length)

      // Step 3: Write to target provider
      await writeMigrationData(to, 'project', { mcpServers: readFromSource.mcpServers, skills: [] }, dstRoot)

      // Step 4: Read back from target
      const readFromTarget = await readMigrationData(to, 'project', dstRoot)

      // Step 5: Verify servers match
      const expectedServers = SAMPLE_SERVERS.map(normalizeServer).sort((a, b) => a.name.localeCompare(b.name))
      const actualServers = readFromTarget.mcpServers.map(normalizeServer).sort((a, b) => a.name.localeCompare(b.name))
      expect(actualServers).toEqual(expectedServers)
    })
  }
})

// ============================================================
// 5. MCP write format verification tests
//    After writeMigrationData, read raw file and verify structure
// ============================================================

describe('mCP write format verification - raw file structure', () => {
  it('claude project writes .mcp.json with mcpServers key', async () => {
    const root = join(testDir, 'fmt-cc')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('claude', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.mcp.json'), 'utf-8'))
    expect(raw.mcpServers).toBeDefined()
    expect(raw.mcp).toBeUndefined()
    expect(raw.mcp_servers).toBeUndefined()
    expect(typeof raw.mcpServers.filesystem.command).toBe('string')
    expect(Array.isArray(raw.mcpServers.filesystem.args)).toBe(true)
  })

  it('opencode project writes opencode.json with mcp.<name> format', async () => {
    const root = join(testDir, 'fmt-oc')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('opencode', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, 'opencode.json'), 'utf-8'))
    expect(raw.mcp).toBeDefined()
    expect(raw.mcpServers).toBeUndefined()
    // OpenCode: command is an array, uses "environment" not "env"
    const fsSrv = raw.mcp.filesystem
    expect(fsSrv.type).toBe('local')
    expect(Array.isArray(fsSrv.command)).toBe(true)
    expect(fsSrv.command[0]).toBe('npx')
    expect(fsSrv.environment).toBeDefined()
    expect(fsSrv.env).toBeUndefined()
  })

  it('codex project writes .codex/config.toml with [mcp_servers] section', async () => {
    const root = join(testDir, 'fmt-cx')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('codex', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = await fs.readFile(join(root, '.codex', 'config.toml'), 'utf-8')
    const parsed = parseTOML(raw) as Record<string, unknown>
    expect(parsed.mcp_servers).toBeDefined()
    const servers = parsed.mcp_servers as Record<string, Record<string, unknown>>
    expect(servers.filesystem).toBeDefined()
    expect(typeof servers.filesystem.command).toBe('string')
  })

  it('kiro project writes .kiro/settings/mcp.json with mcpServers key', async () => {
    const root = join(testDir, 'fmt-kiro')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('kiro', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.kiro', 'settings', 'mcp.json'), 'utf-8'))
    expect(raw.mcpServers).toBeDefined()
    expect(raw.mcp).toBeUndefined()
  })

  it('cursor project writes .cursor/mcp.json with mcpServers key', async () => {
    const root = join(testDir, 'fmt-cursor')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('cursor', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.cursor', 'mcp.json'), 'utf-8'))
    expect(raw.mcpServers).toBeDefined()
    expect(raw.mcp).toBeUndefined()
  })

  it('qoder project writes .qoder/mcp.json with mcpServers key', async () => {
    const root = join(testDir, 'fmt-qoder')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('qoder', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.qoder', 'mcp.json'), 'utf-8'))
    expect(raw.mcpServers).toBeDefined()
  })

  it('gemini project writes .gemini/settings.json with mcpServers key', async () => {
    const root = join(testDir, 'fmt-gemini')
    await fs.mkdir(root, { recursive: true })
    await writeMigrationData('gemini', 'project', { mcpServers: SAMPLE_SERVERS, skills: [] }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.gemini', 'settings.json'), 'utf-8'))
    expect(raw.mcpServers).toBeDefined()
  })
})

// ============================================================
// 6. URL transport migration tests
// ============================================================

describe('uRL transport MCP server migration', () => {
  const URL_SERVERS: CanonicalMCPServer[] = [
    { name: 'remote-api', transport: 'url', url: 'https://mcp.example.com/v1' },
    { name: 'local-cmd', transport: 'stdio', command: 'node', args: ['srv.js'] },
  ]

  const URL_PAIRS: [ProviderName, ProviderName][] = [
    ['claude', 'kiro'],
    ['kiro', 'cursor'],
    ['claude', 'opencode'],
    ['opencode', 'claude'],
    ['claude', 'codex'],
    ['codex', 'kiro'],
  ]

  for (const [from, to] of URL_PAIRS) {
    it(`${from} →${to}: URL transport servers migrate correctly`, async () => {
      const srcRoot = join(testDir, `url-${from}-${to}-src`)
      const dstRoot = join(testDir, `url-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      await writeMigrationData(from, 'project', { mcpServers: URL_SERVERS, skills: [] }, srcRoot)
      const readSrc = await readMigrationData(from, 'project', srcRoot)

      await writeMigrationData(to, 'project', { mcpServers: readSrc.mcpServers, skills: [] }, dstRoot)
      const readDst = await readMigrationData(to, 'project', dstRoot)

      expect(readDst.mcpServers.length).toBe(2)

      const remoteSrv = readDst.mcpServers.find(s => s.name === 'remote-api')
      expect(remoteSrv).toBeDefined()
      expect(remoteSrv!.transport).toBe('url')
      expect(remoteSrv!.url).toBe('https://mcp.example.com/v1')

      const localSrv = readDst.mcpServers.find(s => s.name === 'local-cmd')
      expect(localSrv).toBeDefined()
      expect(localSrv!.transport).toBe('stdio')
      expect(localSrv!.command).toBe('node')
    })
  }

  it('opencode serializes URL server as type=remote', () => {
    const serialized = serializeMCPForProvider('opencode', [SAMPLE_URL_SERVER])
    const parsed = JSON.parse(serialized)
    expect(parsed.mcp['remote-api'].type).toBe('remote')
    expect(parsed.mcp['remote-api'].url).toBe('https://mcp.example.com/v1')
    expect(parsed.mcp['remote-api'].command).toBeUndefined()
  })

  it('standard providers serialize URL server with url field', () => {
    for (const provider of ['kiro', 'qoder'] as ProviderName[]) {
      const serialized = serializeMCPForProvider(provider, [SAMPLE_URL_SERVER])
      const parsed = JSON.parse(serialized)
      expect(parsed.mcpServers['remote-api'].url).toBe('https://mcp.example.com/v1')
      expect(parsed.mcpServers['remote-api'].command).toBeUndefined()
    }
  })

  it('claude serializes URL server with type=http', () => {
    const serialized = serializeMCPForProvider('claude', [SAMPLE_URL_SERVER])
    const parsed = JSON.parse(serialized)
    expect(parsed.mcpServers['remote-api'].type).toBe('http')
    expect(parsed.mcpServers['remote-api'].url).toBe('https://mcp.example.com/v1')
  })

  it('gemini serializes URL server with httpUrl field', () => {
    const serialized = serializeMCPForProvider('gemini', [SAMPLE_URL_SERVER])
    const parsed = JSON.parse(serialized)
    expect(parsed.mcpServers['remote-api'].httpUrl).toBe('https://mcp.example.com/v1')
    expect(parsed.mcpServers['remote-api'].url).toBeUndefined()
  })

  it('cursor serializes URL server with type=sse', () => {
    const serialized = serializeMCPForProvider('cursor', [SAMPLE_URL_SERVER])
    const parsed = JSON.parse(serialized)
    expect(parsed.mcpServers['remote-api'].type).toBe('sse')
    expect(parsed.mcpServers['remote-api'].url).toBe('https://mcp.example.com/v1')
  })
})

// ============================================================
// 7. Cross-tool skills migration end-to-end tests
//    Covers structured→structured, structured→flat, flat→structured, flat→flat
// ============================================================

describe('cross-tool skills migration end-to-end', () => {
  // structured→structured pairs
  describe('structured →structured (preserves directory structure)', () => {
    const PAIRS: [ProviderName, ProviderName][] = [
      ['claude', 'qoder'],
      ['qoder', 'claude'],
      ['claude', 'opencode'],
      ['opencode', 'qoder'],
      ['codex', 'claude'],
      ['claude', 'gemini'],
      ['gemini', 'claude'],
      ['gemini', 'qoder'],
      ['claude', 'cursor'],
      ['cursor', 'claude'],
      ['cursor', 'qoder'],
      ['gemini', 'cursor'],
    ]

    for (const [from, to] of PAIRS) {
      it(`${from} →${to}: structured skills preserved`, async () => {
        const srcRoot = join(testDir, `sk-ss-${from}-${to}-src`)
        const dstRoot = join(testDir, `sk-ss-${from}-${to}-dst`)
        await fs.mkdir(srcRoot, { recursive: true })
        await fs.mkdir(dstRoot, { recursive: true })

        // Write structured skills to source
        await writeMigrationData(from, 'project', { mcpServers: [], skills: STRUCTURED_SKILLS }, srcRoot)

        // Read from source
        const readSrc = await readMigrationData(from, 'project', srcRoot)
        expect(readSrc.skills.length).toBe(STRUCTURED_SKILLS.length)

        // Prepare (convert format)
        const { data: prepared } = prepareMigrationData(
          { mcpServers: [], skills: readSrc.skills },
          from,
          'project',
          to,
          'project',
        )

        // Both structured →skills should be same count
        expect(prepared.skills.length).toBe(STRUCTURED_SKILLS.length)

        // Write to target
        await writeMigrationData(to, 'project', prepared, dstRoot)

        // Read back from target
        const readDst = await readMigrationData(to, 'project', dstRoot)

        // Verify all files present with correct content
        for (const original of STRUCTURED_SKILLS) {
          const found = readDst.skills.find(s => s.relativePath === original.relativePath)
          expect(found, `Missing: ${original.relativePath}`).toBeDefined()
          expect(found!.content).toBe(original.content)
        }
      })
    }
  })

  // structured→flat pairs
  describe('structured →flat (SKILL.md becomes <name>.md, references dropped)', () => {
    const PAIRS: [ProviderName, ProviderName][] = [
      ['claude', 'kiro'], // kiro project is flat (.kiro/steering)
      ['opencode', 'kiro'],
      ['cursor', 'kiro'],
    ]

    for (const [from, to] of PAIRS) {
      it(`${from} →${to}: structured skills flattened`, async () => {
        const srcRoot = join(testDir, `sk-sf-${from}-${to}-src`)
        const dstRoot = join(testDir, `sk-sf-${from}-${to}-dst`)
        await fs.mkdir(srcRoot, { recursive: true })
        await fs.mkdir(dstRoot, { recursive: true })

        await writeMigrationData(from, 'project', { mcpServers: [], skills: STRUCTURED_SKILLS }, srcRoot)
        const readSrc = await readMigrationData(from, 'project', srcRoot)

        const { data: prepared } = prepareMigrationData(
          { mcpServers: [], skills: readSrc.skills },
          from,
          'project',
          to,
          'project',
        )

        // Flat: only SKILL.md files become <name>.md, references are dropped
        const skillMdCount = STRUCTURED_SKILLS.filter(s => s.relativePath.endsWith('/SKILL.md')).length
        expect(prepared.skills.length).toBe(skillMdCount)

        // Verify naming: <dirname>.md
        for (const skill of prepared.skills) {
          expect(skill.relativePath).toMatch(/^[a-z][a-z0-9-]*\.md$/)
        }

        await writeMigrationData(to, 'project', prepared, dstRoot)
        const readDst = await readMigrationData(to, 'project', dstRoot)

        expect(readDst.skills.length).toBe(skillMdCount)
        // Verify content matches the SKILL.md content
        const codingStd = readDst.skills.find(s => s.relativePath === 'coding-standards.md')
        expect(codingStd).toBeDefined()
        expect(codingStd!.content).toBe('# Coding Standards\nFollow these rules...')

        const testing = readDst.skills.find(s => s.relativePath === 'testing.md')
        expect(testing).toBeDefined()
        expect(testing!.content).toBe('# Testing Guide\nWrite unit tests for all functions.')
      })
    }
  })

  // flat→structured pairs
  describe('flat →structured (<name>.md becomes <name>/SKILL.md)', () => {
    const PAIRS: [ProviderName, ProviderName][] = [
      ['kiro', 'claude'], // kiro project is flat
      ['kiro', 'gemini'],
      ['kiro', 'cursor'],
      ['kiro', 'qoder'],
    ]

    for (const [from, to] of PAIRS) {
      it(`${from} →${to}: flat skills become structured`, async () => {
        const srcRoot = join(testDir, `sk-fs-${from}-${to}-src`)
        const dstRoot = join(testDir, `sk-fs-${from}-${to}-dst`)
        await fs.mkdir(srcRoot, { recursive: true })
        await fs.mkdir(dstRoot, { recursive: true })

        await writeMigrationData(from, 'project', { mcpServers: [], skills: FLAT_SKILLS }, srcRoot)
        const readSrc = await readMigrationData(from, 'project', srcRoot)

        const { data: prepared } = prepareMigrationData(
          { mcpServers: [], skills: readSrc.skills },
          from,
          'project',
          to,
          'project',
        )

        // Each flat .md →<name>/SKILL.md
        expect(prepared.skills.length).toBe(FLAT_SKILLS.length)
        for (const skill of prepared.skills) {
          expect(skill.relativePath).toMatch(/^[a-z][a-z0-9-]*\/SKILL\.md$/)
        }

        await writeMigrationData(to, 'project', prepared, dstRoot)
        const readDst = await readMigrationData(to, 'project', dstRoot)

        expect(readDst.skills.length).toBe(FLAT_SKILLS.length)
        const codingStd = readDst.skills.find(s => s.relativePath === 'coding-standards/SKILL.md')
        expect(codingStd).toBeDefined()
        expect(codingStd!.content).toBe('# Coding Standards\nFollow these rules...')
      })
    }
  })

  // flat→flat pairs (only kiro-project is flat now)
  // cursor is now structured, so no flat→flat cursor pairs remain
  // kiro→kiro would be same provider, not tested here
})

// ============================================================
// 8. Full migration pipeline tests
//    readMigrationData →prepareMigrationData →buildMigrationPlan →executeMigrationPlan →readMigrationData (verify)
// ============================================================

describe('full migration pipeline end-to-end', () => {
  const PIPELINE_PAIRS: [ProviderName, ProviderName][] = [
    ['claude', 'kiro'],
    ['kiro', 'claude'],
    ['claude', 'cursor'],
    ['opencode', 'kiro'],
    ['codex', 'claude'],
    ['cursor', 'qoder'],
    ['gemini', 'kiro'],
    ['claude', 'opencode'],
    ['claude', 'codex'],
  ]

  for (const [from, to] of PIPELINE_PAIRS) {
    it(`${from} →${to}: full pipeline with MCP + skills`, async () => {
      const srcRoot = join(testDir, `pipe-${from}-${to}-src`)
      const dstRoot = join(testDir, `pipe-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      // Determine appropriate skills for source format
      const srcStructured = isStructuredSkills(from, 'project')
      const skills = srcStructured ? STRUCTURED_SKILLS : FLAT_SKILLS

      // Step 1: Write source data
      await writeMigrationData(from, 'project', { mcpServers: SAMPLE_SERVERS, skills }, srcRoot)

      // Step 2: Read source data
      const sourceData = await readMigrationData(from, 'project', srcRoot)
      expect(sourceData.mcpServers.length).toBeGreaterThan(0)
      expect(sourceData.skills.length).toBeGreaterThan(0)

      // Step 3: Prepare for target
      const { data: prepared } = prepareMigrationData(sourceData, from, 'project', to, 'project')

      // Step 4: Build plan
      const plan = await buildMigrationPlan(from, to, 'project', prepared, dstRoot)
      expect(plan.items.length).toBeGreaterThan(0)
      // All should be 'create' since dstRoot is empty
      for (const item of plan.items) {
        expect(item.action).toBe('create')
      }

      // Step 5: Execute plan
      await executeMigrationPlan(plan, prepared, dstRoot)

      // Step 6: Read back from target and verify
      const targetData = await readMigrationData(to, 'project', dstRoot)

      // Verify MCP servers
      expect(targetData.mcpServers.length).toBe(SAMPLE_SERVERS.length)
      for (const expected of SAMPLE_SERVERS) {
        const found = targetData.mcpServers.find(s => s.name === expected.name)
        expect(found, `Missing MCP server: ${expected.name}`).toBeDefined()
        expect(found!.command).toBe(expected.command)
        expect(found!.args).toEqual(expected.args)
        if (expected.env && Object.keys(expected.env).length > 0) {
          expect(found!.env).toEqual(expected.env)
        }
      }

      // Verify skills count (may differ due to format conversion)
      expect(targetData.skills.length).toBeGreaterThan(0)
    })
  }
})

// ============================================================
// 9. MCP config merge (preserves existing fields)
// ============================================================

describe('mCP config merge - preserves existing fields', () => {
  it('claude: existing fields in .mcp.json are preserved', async () => {
    const root = join(testDir, 'merge-cc')
    await fs.mkdir(root, { recursive: true })
    // Pre-existing config with extra fields
    await fs.writeFile(join(root, '.mcp.json'), JSON.stringify({
      mcpServers: { 'old-server': { command: 'old', args: [] } },
      someOtherField: 'keep-me',
    }), 'utf-8')

    await writeMigrationData('claude', 'project', {
      mcpServers: [{ name: 'new-server', transport: 'stdio', command: 'new', args: ['--flag'] }],
      skills: [],
    }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.mcp.json'), 'utf-8'))
    expect(raw.someOtherField).toBe('keep-me')
    expect(raw.mcpServers['new-server']).toBeDefined()
  })

  it('opencode: existing fields in opencode.json are preserved', async () => {
    const root = join(testDir, 'merge-oc')
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(join(root, 'opencode.json'), JSON.stringify({
      mcp: { 'old-srv': { type: 'local', command: ['old'] } },
      theme: 'dark',
    }), 'utf-8')

    await writeMigrationData('opencode', 'project', {
      mcpServers: [{ name: 'new-srv', transport: 'stdio', command: 'new', args: [] }],
      skills: [],
    }, root)

    const raw = JSON.parse(await fs.readFile(join(root, 'opencode.json'), 'utf-8'))
    expect(raw.theme).toBe('dark')
    expect(raw.mcp['new-srv']).toBeDefined()
    expect(raw.mcp['old-srv']).toBeDefined()
  })

  it('kiro: existing fields in mcp.json are preserved', async () => {
    const root = join(testDir, 'merge-kiro')
    await fs.mkdir(join(root, '.kiro', 'settings'), { recursive: true })
    await fs.writeFile(join(root, '.kiro', 'settings', 'mcp.json'), JSON.stringify({
      mcpServers: { existing: { command: 'keep', args: [] } },
      customSetting: true,
    }), 'utf-8')

    await writeMigrationData('kiro', 'project', {
      mcpServers: [{ name: 'added', transport: 'stdio', command: 'new', args: [] }],
      skills: [],
    }, root)

    const raw = JSON.parse(await fs.readFile(join(root, '.kiro', 'settings', 'mcp.json'), 'utf-8'))
    expect(raw.customSetting).toBe(true)
    expect(raw.mcpServers.added).toBeDefined()
  })
})

// ============================================================
// 10. Cross-format MCP serialization round-trip matrix
//     For every pair of providers, serialize→parse→serialize→parse should be stable
// ============================================================

describe('cross-format MCP serialization stability', () => {
  // Test a representative subset to avoid O(n²) explosion
  const PAIRS: [ProviderName, ProviderName][] = [
    ['claude', 'opencode'],
    ['opencode', 'codex'],
    ['codex', 'claude'],
    ['kiro', 'opencode'],
    ['cursor', 'codex'],
    ['gemini', 'opencode'],
    ['qoder', 'codex'],
  ]

  for (const [provA, provB] of PAIRS) {
    it(`${provA} →${provB} →${provA}: double round-trip is stable`, () => {
      // Serialize for provA
      const serialA = serializeMCPForProvider(provA, SAMPLE_SERVERS)
      // Parse as provA
      const parsedA = parseMCPFromProvider(provA, serialA)
      // Serialize for provB
      const serialB = serializeMCPForProvider(provB, parsedA)
      // Parse as provB
      const parsedB = parseMCPFromProvider(provB, serialB)
      // Serialize back for provA
      const serialA2 = serializeMCPForProvider(provA, parsedB)
      // Parse again as provA
      const parsedA2 = parseMCPFromProvider(provA, serialA2)

      // Should be stable after double round-trip
      const normalize = (servers: CanonicalMCPServer[]) =>
        servers.map((s) => {
          const base: any = { name: s.name, transport: s.transport }
          if (s.transport === 'url') {
            base.url = s.url
          }
          else {
            base.command = s.command ?? ''
            base.args = [...(s.args ?? [])]
          }
          if (s.headers && Object.keys(s.headers).length > 0)
            base.headers = { ...s.headers }
          if (s.env && Object.keys(s.env).length > 0)
            base.env = { ...s.env }
          return base
        }).sort((a: any, b: any) => a.name.localeCompare(b.name))

      expect(normalize(parsedA2)).toEqual(normalize(parsedA))
    })
  }
})

// ============================================================
// 11. Skills directory write path verification
//     Verify files end up in the correct filesystem location
// ============================================================

describe('skills write path verification - filesystem locations', () => {
  const pathChecks: { provider: ProviderName, scope: MigrationScope, expectedDir: string }[] = [
    { provider: 'claude', scope: 'project', expectedDir: '.claude/skills' },
    { provider: 'kiro', scope: 'project', expectedDir: '.kiro/steering' },
    { provider: 'opencode', scope: 'project', expectedDir: '.opencode/skills' },
    { provider: 'codex', scope: 'project', expectedDir: '.codex/skills' },
    { provider: 'qoder', scope: 'project', expectedDir: '.qoder/skills' },
    { provider: 'gemini', scope: 'project', expectedDir: '.gemini/skills' },
    { provider: 'cursor', scope: 'project', expectedDir: '.cursor/skills' },
  ]

  for (const { provider, scope, expectedDir } of pathChecks) {
    it(`${provider} / ${scope}: skills written to ${expectedDir}`, async () => {
      const root = join(testDir, `skillpath-${provider}`)
      await fs.mkdir(root, { recursive: true })

      const skills: SkillFile[] = [{ relativePath: 'test-skill.md', content: '# Test' }]
      await writeMigrationData(provider, scope, { mcpServers: [], skills }, root)

      const expectedPath = join(root, expectedDir, 'test-skill.md')
      const content = await fs.readFile(expectedPath, 'utf-8')
      expect(content).toBe('# Test')
    })
  }
})

// ============================================================
// 12. MCP config write path verification
//     Verify MCP config files end up in the correct filesystem location
// ============================================================

describe('mCP config write path verification - filesystem locations', () => {
  const pathChecks: { provider: ProviderName, scope: MigrationScope, expectedPath: string }[] = [
    { provider: 'claude', scope: 'project', expectedPath: '.mcp.json' },
    { provider: 'kiro', scope: 'project', expectedPath: '.kiro/settings/mcp.json' },
    { provider: 'opencode', scope: 'project', expectedPath: 'opencode.json' },
    { provider: 'codex', scope: 'project', expectedPath: '.codex/config.toml' },
    { provider: 'qoder', scope: 'project', expectedPath: '.qoder/mcp.json' },
    { provider: 'gemini', scope: 'project', expectedPath: '.gemini/settings.json' },
    { provider: 'cursor', scope: 'project', expectedPath: '.cursor/mcp.json' },
  ]

  for (const { provider, scope, expectedPath } of pathChecks) {
    it(`${provider} / ${scope}: MCP config written to ${expectedPath}`, async () => {
      const root = join(testDir, `mcppath-${provider}`)
      await fs.mkdir(root, { recursive: true })

      const servers: CanonicalMCPServer[] = [{ name: 'test', transport: 'stdio', command: 'cmd', args: [] }]
      await writeMigrationData(provider, scope, { mcpServers: servers, skills: [] }, root)

      const fullPath = join(root, expectedPath)
      const stat = await fs.stat(fullPath)
      expect(stat.isFile()).toBe(true)
    })
  }
})
