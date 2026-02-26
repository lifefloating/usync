import type { ProviderName } from '../src/types.js'
import type { CanonicalMCPServer } from '../src/utils/mcp.js'
import type { MigrationData, SkillFile } from '../src/utils/migration-adapter.js'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
/**
 * Exhaustive cross-migration test: ALL from→to provider combinations.
 * 7 providers × 6 targets = 42 pairs, tested for both MCP and skills.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepareMigrationData, readMigrationData, writeMigrationData } from '../src/utils/migration-adapter.js'
import { isStructuredSkills } from '../src/utils/migration-paths.js'
import { buildMigrationPlan, executeMigrationPlan } from '../src/utils/migration-plan.js'

const ALL_PROVIDERS: ProviderName[] = ['claude', 'opencode', 'codex', 'gemini', 'kiro', 'qoder', 'cursor']

// Generate all 42 from→to pairs (excluding same→same)
const ALL_PAIRS: [ProviderName, ProviderName][] = []
for (const from of ALL_PROVIDERS) {
  for (const to of ALL_PROVIDERS) {
    if (from !== to)
      ALL_PAIRS.push([from, to])
  }
}

let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `usync-allcomb-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

// ── Test data ──

const STDIO_SERVERS: CanonicalMCPServer[] = [
  { name: 'filesystem', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'], env: { NODE_ENV: 'production' } },
  { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: 'ghp_test123' } },
  { name: 'simple', transport: 'stdio', command: 'node', args: ['server.js'] },
]

const URL_SERVER: CanonicalMCPServer = {
  name: 'remote-api',
  transport: 'url',
  url: 'https://mcp.example.com/v1',
}

const URL_SERVER_WITH_HEADERS: CanonicalMCPServer = {
  name: 'authed-api',
  transport: 'url',
  url: 'https://mcp.example.com/secure',
  headers: { Authorization: 'Bearer tok_123' },
}

const MIXED_SERVERS: CanonicalMCPServer[] = [
  ...STDIO_SERVERS,
  URL_SERVER,
]

const STRUCTURED_SKILLS: SkillFile[] = [
  { relativePath: 'coding-standards/SKILL.md', content: '# Coding Standards\nFollow these rules...' },
  { relativePath: 'coding-standards/references/eslint.md', content: '# ESLint Config\nUse strict mode.' },
  { relativePath: 'coding-standards/references/prettier.md', content: '# Prettier\nUse 2-space indent.' },
  { relativePath: 'testing/SKILL.md', content: '# Testing Guide\nWrite unit tests.' },
  { relativePath: 'testing/references/vitest.md', content: '# Vitest Setup\nUse vitest.' },
]

const FLAT_SKILLS: SkillFile[] = [
  { relativePath: 'coding-standards.md', content: '# Coding Standards\nFollow these rules...' },
  { relativePath: 'testing.md', content: '# Testing Guide\nWrite unit tests.' },
  { relativePath: 'deployment.md', content: '# Deployment\nUse CI/CD pipeline.' },
]

// ── Helpers ──

function normalizeServer(s: CanonicalMCPServer): Record<string, unknown> {
  const base: Record<string, unknown> = { name: s.name, transport: s.transport }
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

function sortByName(servers: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...servers].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

// ============================================================
// 1. ALL 42 pairs: Stdio MCP servers write→read→write→read cycle
// ============================================================

describe('aLL pairs: Stdio MCP servers survive write→read→write→read cycle', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}`, async () => {
      const srcRoot = join(testDir, `stdio-${from}-${to}-src`)
      const dstRoot = join(testDir, `stdio-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      // Write to source
      await writeMigrationData(from, 'project', { mcpServers: STDIO_SERVERS, skills: [] }, srcRoot)

      // Read from source
      const readSrc = await readMigrationData(from, 'project', srcRoot)
      expect(readSrc.mcpServers.length).toBe(STDIO_SERVERS.length)

      // Write to target
      await writeMigrationData(to, 'project', { mcpServers: readSrc.mcpServers, skills: [] }, dstRoot)

      // Read from target
      const readDst = await readMigrationData(to, 'project', dstRoot)

      // Verify all servers survived
      expect(readDst.mcpServers.length).toBe(STDIO_SERVERS.length)
      const expected = sortByName(STDIO_SERVERS.map(normalizeServer))
      const actual = sortByName(readDst.mcpServers.map(normalizeServer))
      expect(actual).toEqual(expected)
    })
  }
})

// ============================================================
// 2. ALL 42 pairs: Mixed (stdio + URL) MCP servers migration
// ============================================================

describe('aLL pairs: Mixed stdio+URL MCP servers survive migration', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}`, async () => {
      const srcRoot = join(testDir, `mixed-${from}-${to}-src`)
      const dstRoot = join(testDir, `mixed-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      await writeMigrationData(from, 'project', { mcpServers: MIXED_SERVERS, skills: [] }, srcRoot)
      const readSrc = await readMigrationData(from, 'project', srcRoot)
      await writeMigrationData(to, 'project', { mcpServers: readSrc.mcpServers, skills: [] }, dstRoot)
      const readDst = await readMigrationData(to, 'project', dstRoot)

      expect(readDst.mcpServers.length).toBe(MIXED_SERVERS.length)

      // Verify URL server
      const urlSrv = readDst.mcpServers.find(s => s.name === 'remote-api')
      expect(urlSrv).toBeDefined()
      expect(urlSrv!.transport).toBe('url')
      expect(urlSrv!.url).toBe('https://mcp.example.com/v1')

      // Verify stdio servers
      for (const expected of STDIO_SERVERS) {
        const found = readDst.mcpServers.find(s => s.name === expected.name)
        expect(found, `Missing: ${expected.name}`).toBeDefined()
        expect(found!.transport).toBe('stdio')
        expect(found!.command).toBe(expected.command)
        expect(found!.args).toEqual(expected.args)
      }
    })
  }
})

// ============================================================
// 3. ALL 42 pairs: Skills migration with format conversion
// ============================================================

describe('aLL pairs: Skills migration with automatic format conversion', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}`, async () => {
      const srcRoot = join(testDir, `skills-${from}-${to}-src`)
      const dstRoot = join(testDir, `skills-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      const srcStructured = isStructuredSkills(from, 'project')
      const dstStructured = isStructuredSkills(to, 'project')
      const sourceSkills = srcStructured ? STRUCTURED_SKILLS : FLAT_SKILLS

      // Write source skills
      await writeMigrationData(from, 'project', { mcpServers: [], skills: sourceSkills }, srcRoot)

      // Read from source
      const readSrc = await readMigrationData(from, 'project', srcRoot)
      expect(readSrc.skills.length).toBeGreaterThan(0)

      // Prepare (format conversion)
      const { data: prepared } = prepareMigrationData(
        { mcpServers: [], skills: readSrc.skills },
        from,
        'project',
        to,
        'project',
      )

      // Verify conversion logic
      if (srcStructured && dstStructured) {
        // structured→structured: all files preserved
        expect(prepared.skills.length).toBe(sourceSkills.length)
      }
      else if (srcStructured && !dstStructured) {
        // structured→flat: only SKILL.md files, renamed to <name>.md
        const skillMdCount = sourceSkills.filter(s => s.relativePath.endsWith('/SKILL.md')).length
        expect(prepared.skills.length).toBe(skillMdCount)
        for (const skill of prepared.skills) {
          expect(skill.relativePath).toMatch(/^[a-z][a-z0-9-]*\.md$/)
        }
      }
      else if (!srcStructured && dstStructured) {
        // flat→structured: <name>.md →<name>/SKILL.md
        expect(prepared.skills.length).toBe(sourceSkills.length)
        for (const skill of prepared.skills) {
          expect(skill.relativePath).toMatch(/\/SKILL\.md$/)
        }
      }
      else {
        // flat→flat: direct copy
        expect(prepared.skills.length).toBe(sourceSkills.length)
      }

      // Write to target
      await writeMigrationData(to, 'project', prepared, dstRoot)

      // Read back from target
      const readDst = await readMigrationData(to, 'project', dstRoot)
      expect(readDst.skills.length).toBe(prepared.skills.length)

      // Verify content integrity
      for (const expected of prepared.skills) {
        const found = readDst.skills.find(s => s.relativePath === expected.relativePath)
        expect(found, `Missing skill: ${expected.relativePath}`).toBeDefined()
        expect(found!.content).toBe(expected.content)
      }
    })
  }
})

// ============================================================
// 4. ALL 42 pairs: Full pipeline (read→prepare→plan→execute→verify)
// ============================================================

describe('aLL pairs: Full migration pipeline end-to-end', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}`, async () => {
      const srcRoot = join(testDir, `pipe-${from}-${to}-src`)
      const dstRoot = join(testDir, `pipe-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      const srcStructured = isStructuredSkills(from, 'project')
      const skills = srcStructured ? STRUCTURED_SKILLS : FLAT_SKILLS

      // Step 1: Write source data (MCP + skills)
      await writeMigrationData(from, 'project', { mcpServers: STDIO_SERVERS, skills }, srcRoot)

      // Step 2: Read source
      const sourceData = await readMigrationData(from, 'project', srcRoot)
      expect(sourceData.mcpServers.length).toBe(STDIO_SERVERS.length)
      expect(sourceData.skills.length).toBeGreaterThan(0)

      // Step 3: Prepare for target
      const { data: prepared } = prepareMigrationData(sourceData, from, 'project', to, 'project')

      // Step 4: Build plan (empty target →all create)
      const plan = await buildMigrationPlan(from, to, 'project', prepared, dstRoot)
      expect(plan.items.length).toBeGreaterThan(0)
      for (const item of plan.items) {
        expect(item.action).toBe('create')
      }

      // Step 5: Execute
      await executeMigrationPlan(plan, prepared, dstRoot)

      // Step 6: Read back and verify
      const targetData = await readMigrationData(to, 'project', dstRoot)

      // Verify MCP servers
      expect(targetData.mcpServers.length).toBe(STDIO_SERVERS.length)
      for (const expected of STDIO_SERVERS) {
        const found = targetData.mcpServers.find(s => s.name === expected.name)
        expect(found, `Missing MCP: ${expected.name}`).toBeDefined()
        expect(found!.command).toBe(expected.command)
        expect(found!.args).toEqual(expected.args)
      }

      // Verify skills exist
      expect(targetData.skills.length).toBeGreaterThan(0)
    })
  }
})

// ============================================================
// 5. ALL 42 pairs: Conflict detection (pre-existing target)
// ============================================================

describe('aLL pairs: Conflict detection when target already has data', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}: existing target files marked as conflict`, async () => {
      const srcRoot = join(testDir, `conf-${from}-${to}-src`)
      const dstRoot = join(testDir, `conf-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      const skills: SkillFile[] = [{ relativePath: 'existing.md', content: '# Existing' }]

      // Pre-populate target with same data
      await writeMigrationData(to, 'project', { mcpServers: STDIO_SERVERS, skills }, dstRoot)

      // Now build plan →everything should be conflict
      const data: MigrationData = { mcpServers: STDIO_SERVERS, skills }
      const plan = await buildMigrationPlan(from, to, 'project', data, dstRoot)

      expect(plan.items.length).toBeGreaterThan(0)
      for (const item of plan.items) {
        expect(item.action).toBe('conflict')
      }
    })
  }
})

// ============================================================
// 6. ALL 42 pairs: Double migration (A→B→A) round-trip stability
// ============================================================

describe('aLL pairs: Double migration A→B→A round-trip for MCP', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to} →${from}: servers survive double migration`, async () => {
      const root1 = join(testDir, `dbl-${from}-${to}-1`)
      const root2 = join(testDir, `dbl-${from}-${to}-2`)
      const root3 = join(testDir, `dbl-${from}-${to}-3`)
      await fs.mkdir(root1, { recursive: true })
      await fs.mkdir(root2, { recursive: true })
      await fs.mkdir(root3, { recursive: true })

      // Write original to provider A
      await writeMigrationData(from, 'project', { mcpServers: STDIO_SERVERS, skills: [] }, root1)

      // Read from A
      const dataA = await readMigrationData(from, 'project', root1)

      // Write to B
      await writeMigrationData(to, 'project', { mcpServers: dataA.mcpServers, skills: [] }, root2)

      // Read from B
      const dataB = await readMigrationData(to, 'project', root2)

      // Write back to A
      await writeMigrationData(from, 'project', { mcpServers: dataB.mcpServers, skills: [] }, root3)

      // Read from A again
      const dataA2 = await readMigrationData(from, 'project', root3)

      // Should be identical to original
      const expected = sortByName(STDIO_SERVERS.map(normalizeServer))
      const actual = sortByName(dataA2.mcpServers.map(normalizeServer))
      expect(actual).toEqual(expected)
    })
  }
})

// ============================================================
// 7. URL server with headers: migration compatibility matrix
// ============================================================

describe('uRL server with headers: migration across all pairs', () => {
  const SERVERS_WITH_HEADERS: CanonicalMCPServer[] = [
    URL_SERVER_WITH_HEADERS,
    { name: 'simple-cmd', transport: 'stdio', command: 'node', args: ['srv.js'] },
  ]

  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}: URL server with headers handled correctly`, async () => {
      const srcRoot = join(testDir, `hdr-${from}-${to}-src`)
      const dstRoot = join(testDir, `hdr-${from}-${to}-dst`)
      await fs.mkdir(srcRoot, { recursive: true })
      await fs.mkdir(dstRoot, { recursive: true })

      // Write source
      await writeMigrationData(from, 'project', { mcpServers: SERVERS_WITH_HEADERS, skills: [] }, srcRoot)
      const readSrc = await readMigrationData(from, 'project', srcRoot)

      // Prepare with header filtering
      const { data: prepared, skippedServers } = prepareMigrationData(
        { mcpServers: readSrc.mcpServers, skills: [] },
        from,
        'project',
        to,
        'project',
      )

      // qoder doesn't support headers →authed-api should be skipped
      // All other providers support headers
      if (to === 'qoder') {
        expect(skippedServers.length).toBe(1)
        expect(skippedServers[0].name).toBe('authed-api')
        expect(prepared.mcpServers.length).toBe(1) // only simple-cmd
      }
      else {
        expect(skippedServers.length).toBe(0)
        expect(prepared.mcpServers.length).toBe(2)
      }

      // Write to target and verify
      await writeMigrationData(to, 'project', prepared, dstRoot)
      const readDst = await readMigrationData(to, 'project', dstRoot)

      // stdio server always survives
      const simpleSrv = readDst.mcpServers.find(s => s.name === 'simple-cmd')
      expect(simpleSrv).toBeDefined()
      expect(simpleSrv!.command).toBe('node')
    })
  }
})

// ============================================================
// 8. Empty source: all pairs handle gracefully
// ============================================================

describe('aLL pairs: Empty source data handled gracefully', () => {
  for (const [from, to] of ALL_PAIRS) {
    it(`${from} →${to}: empty data produces empty result`, async () => {
      const dstRoot = join(testDir, `empty-${from}-${to}`)
      await fs.mkdir(dstRoot, { recursive: true })

      const emptyData: MigrationData = { mcpServers: [], skills: [] }
      const { data: prepared } = prepareMigrationData(emptyData, from, 'project', to, 'project')

      expect(prepared.mcpServers).toEqual([])
      expect(prepared.skills).toEqual([])

      const plan = await buildMigrationPlan(from, to, 'project', prepared, dstRoot)
      expect(plan.items).toEqual([])
    })
  }
})
