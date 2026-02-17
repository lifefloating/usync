import { describe, expect, it } from 'vitest'
import os from 'node:os'
import { join } from 'pathe'
import { PROVIDERS, resolveProviders } from '../src/providers.js'
import { templatePathToOutputPath } from '../src/utils/path.js'
import type { ProviderName } from '../src/types.js'

const home = os.homedir()
const projectRoot = '/tmp/test-project'

function findProvider(name: ProviderName) {
  return PROVIDERS.find(p => p.name === name)!
}

// ============================================================
// All 7 providers are registered
// ============================================================

describe('PROVIDERS registry', () => {
  const ALL: ProviderName[] = ['claudecode', 'opencode', 'codex', 'gemini-cli', 'kiro', 'qoder', 'cursor']

  it('contains all 7 providers', () => {
    expect(PROVIDERS.length).toBe(7)
    for (const name of ALL) {
      expect(PROVIDERS.some(p => p.name === name), `missing provider: ${name}`).toBe(true)
    }
  })

  it('each provider has a unique name', () => {
    const names = PROVIDERS.map(p => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('each provider returns at least one target', () => {
    for (const p of PROVIDERS) {
      expect(p.targets(projectRoot).length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// claudecode provider
// ============================================================

describe('claudecode provider', () => {
  const targets = findProvider('claudecode').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.claude.json as global MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.claude/settings.json as global settings (file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.claude/settings.local.json as global local settings (file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude', 'settings.local.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.claude/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })

    it('has ~/.claude/teams as global teams (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude', 'teams'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('teams')
      expect(t!.isDirectory).toBe(true)
    })

    it('has ~/.claude/tasks as global tasks (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.claude', 'tasks'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('teams')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .mcp.json as project MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .claude/settings.json as project settings (file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.claude', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .claude/settings.local.json as project local settings (file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.claude', 'settings.local.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .claude/skills as project skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.claude', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 10 targets total', () => {
    expect(targets.length).toBe(10)
  })
})

// ============================================================
// opencode provider
// ============================================================

describe('opencode provider', () => {
  const targets = findProvider('opencode').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.config/opencode/opencode.json as global config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.config', 'opencode', 'opencode.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.config/opencode/opencode.jsonc as global config jsonc (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.config', 'opencode', 'opencode.jsonc'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.config/opencode/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.config', 'opencode', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has opencode.json as project config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, 'opencode.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has opencode.jsonc as project config jsonc (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, 'opencode.jsonc'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .opencode/skills as project skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.opencode', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })
})


// ============================================================
// codex provider
// ============================================================

describe('codex provider', () => {
  const targets = findProvider('codex').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.codex/config.toml as global TOML config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.codex', 'config.toml'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.codex/config.json as global config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.codex', 'config.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.codex/settings.json as global settings (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.codex', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.codex/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.codex', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .codex/config.toml as project TOML config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.codex', 'config.toml'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .codex/config.json as project config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.codex', 'config.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .codex/settings.json as project settings (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.codex', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .codex/skills as project skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.codex', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 8 targets total', () => {
    expect(targets.length).toBe(8)
  })
})

// ============================================================
// gemini-cli provider
// ============================================================

describe('gemini-cli provider', () => {
  const targets = findProvider('gemini-cli').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.gemini/settings.json as global settings (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.gemini', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.gemini/extensions as global extensions (other, directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.gemini', 'extensions'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('other')
      expect(t!.isDirectory).toBe(true)
    })

    it('has ~/.gemini/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.gemini', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .gemini/settings.json as project settings (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.gemini', 'settings.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .gemini/extensions as project extensions (other, directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.gemini', 'extensions'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('other')
      expect(t!.isDirectory).toBe(true)
    })

    it('has .gemini/skills as project skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.gemini', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 6 targets total', () => {
    expect(targets.length).toBe(6)
  })
})

// ============================================================
// kiro provider
// ============================================================

describe('kiro provider', () => {
  const targets = findProvider('kiro').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.kiro/settings/mcp.json as global MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.kiro', 'settings', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.kiro/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.kiro', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .kiro/settings/mcp.json as project MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.kiro', 'settings', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .kiro/steering as project steering (skills, directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.kiro', 'steering'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 4 targets total', () => {
    expect(targets.length).toBe(4)
  })
})

// ============================================================
// qoder provider
// ============================================================

describe('qoder provider', () => {
  const targets = findProvider('qoder').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.qoder/mcp.json as global MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.qoder', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.qoder/skills as global skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.qoder', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .qoder/mcp.json as project MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.qoder', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .qoder/skills as project skills (directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.qoder', 'skills'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 4 targets total', () => {
    expect(targets.length).toBe(4)
  })
})

// ============================================================
// cursor provider
// ============================================================

describe('cursor provider', () => {
  const targets = findProvider('cursor').targets(projectRoot)

  describe('global targets', () => {
    it('has ~/.cursor/mcp.json as global MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.cursor', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has ~/.cursor/rules as global rules (skills, directory)', () => {
      const t = targets.find(t => t.absolutePath === join(home, '.cursor', 'rules'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  describe('project targets', () => {
    it('has .cursor/mcp.json as project MCP config (settings, file)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.cursor', 'mcp.json'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('settings')
      expect(t!.isDirectory).toBe(false)
    })

    it('has .cursor/rules as project rules (skills, directory)', () => {
      const t = targets.find(t => t.absolutePath === join(projectRoot, '.cursor', 'rules'))
      expect(t).toBeDefined()
      expect(t!.category).toBe('skills')
      expect(t!.isDirectory).toBe(true)
    })
  })

  it('has 4 targets total', () => {
    expect(targets.length).toBe(4)
  })
})


// ============================================================
// resolveProviders
// ============================================================

describe('resolveProviders', () => {
  it('returns all providers when no filter is given', () => {
    const result = resolveProviders()
    expect(result.length).toBe(7)
  })

  it('returns all providers when filter is undefined', () => {
    const result = resolveProviders(undefined)
    expect(result.length).toBe(7)
  })

  it('returns all providers when filter is empty string', () => {
    const result = resolveProviders('')
    expect(result.length).toBe(7)
  })

  it('filters to a single provider', () => {
    const result = resolveProviders('kiro')
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('kiro')
  })

  it('filters to multiple comma-separated providers', () => {
    const result = resolveProviders('claudecode,kiro,cursor')
    expect(result.length).toBe(3)
    expect(result.map(p => p.name).sort()).toEqual(['claudecode', 'cursor', 'kiro'])
  })

  it('handles whitespace around commas', () => {
    const result = resolveProviders('codex , gemini-cli')
    expect(result.length).toBe(2)
    expect(result.map(p => p.name).sort()).toEqual(['codex', 'gemini-cli'])
  })

  it('returns empty array for unknown provider name', () => {
    const result = resolveProviders('nonexistent')
    expect(result.length).toBe(0)
  })

  it('ignores unknown names mixed with valid ones', () => {
    const result = resolveProviders('kiro,fake,opencode')
    expect(result.length).toBe(2)
    expect(result.map(p => p.name).sort()).toEqual(['kiro', 'opencode'])
  })
})

// ============================================================
// Category distribution checks across all providers
// ============================================================

describe('provider target categories', () => {
  it('every provider has at least one settings target', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const settings = targets.filter(t => t.category === 'settings')
      expect(settings.length, `${p.name} should have settings targets`).toBeGreaterThan(0)
    }
  })

  it('every provider has at least one skills target', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const skills = targets.filter(t => t.category === 'skills')
      expect(skills.length, `${p.name} should have skills targets`).toBeGreaterThan(0)
    }
  })

  it('skills targets are always directories', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const skills = targets.filter(t => t.category === 'skills')
      for (const s of skills) {
        expect(s.isDirectory, `${p.name}: ${s.label} should be a directory`).toBe(true)
      }
    }
  })

  it('settings targets are always files', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const settings = targets.filter(t => t.category === 'settings')
      for (const s of settings) {
        expect(s.isDirectory, `${p.name}: ${s.label} should be a file`).toBe(false)
      }
    }
  })

  it('only claudecode has teams category', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const teams = targets.filter(t => t.category === 'teams')
      if (p.name === 'claudecode') {
        expect(teams.length).toBeGreaterThan(0)
      } else {
        expect(teams.length, `${p.name} should not have teams targets`).toBe(0)
      }
    }
  })

  it('only gemini-cli has other category', () => {
    for (const p of PROVIDERS) {
      const targets = p.targets(projectRoot)
      const other = targets.filter(t => t.category === 'other')
      if (p.name === 'gemini-cli') {
        expect(other.length).toBeGreaterThan(0)
      } else {
        expect(other.length, `${p.name} should not have other targets`).toBe(0)
      }
    }
  })

  it('every target has a non-empty label', () => {
    for (const p of PROVIDERS) {
      for (const t of p.targets(projectRoot)) {
        expect(t.label.length, `${p.name}: target at ${t.absolutePath} has empty label`).toBeGreaterThan(0)
      }
    }
  })

  it('every target has an absolute path', () => {
    for (const p of PROVIDERS) {
      for (const t of p.targets(projectRoot)) {
        // pathe join produces forward-slash paths; just check it's not relative
        expect(
          t.absolutePath.startsWith('/') || t.absolutePath.match(/^[A-Z]:/i),
          `${p.name}: ${t.absolutePath} should be absolute`,
        ).toBeTruthy()
      }
    }
  })
})

// ============================================================
// Global vs project path separation
// ============================================================

describe('global vs project path separation', () => {
  it('claudecode: global targets use home dir, project targets use projectRoot', () => {
    const targets = findProvider('claudecode').targets(projectRoot)
    // Global MCP config is ~/.claude.json (home-based)
    const globalMcp = targets.find(t => t.absolutePath === join(home, '.claude.json'))
    expect(globalMcp).toBeDefined()
    // Project MCP config is .mcp.json (project-based)
    const projectMcp = targets.find(t => t.absolutePath === join(projectRoot, '.mcp.json'))
    expect(projectMcp).toBeDefined()
    // They should be different paths
    expect(globalMcp!.absolutePath).not.toBe(projectMcp!.absolutePath)
  })

  it('kiro: global and project MCP configs are in different directories', () => {
    const targets = findProvider('kiro').targets(projectRoot)
    const globalMcp = targets.find(t => t.absolutePath === join(home, '.kiro', 'settings', 'mcp.json'))
    const projectMcp = targets.find(t => t.absolutePath === join(projectRoot, '.kiro', 'settings', 'mcp.json'))
    expect(globalMcp).toBeDefined()
    expect(projectMcp).toBeDefined()
    expect(globalMcp!.absolutePath).not.toBe(projectMcp!.absolutePath)
  })

  it('cursor: global and project MCP configs are in different directories', () => {
    const targets = findProvider('cursor').targets(projectRoot)
    const globalMcp = targets.find(t => t.absolutePath === join(home, '.cursor', 'mcp.json'))
    const projectMcp = targets.find(t => t.absolutePath === join(projectRoot, '.cursor', 'mcp.json'))
    expect(globalMcp).toBeDefined()
    expect(projectMcp).toBeDefined()
    expect(globalMcp!.absolutePath).not.toBe(projectMcp!.absolutePath)
  })

  it('no provider mixes home and project in a single target path', () => {
    for (const p of PROVIDERS) {
      for (const t of p.targets(projectRoot)) {
        // A path should not contain both home and projectRoot
        const hasHome = t.absolutePath.startsWith(home)
        const hasProject = t.absolutePath.startsWith(projectRoot)
        // At least one must be true (it's an absolute path under one of them)
        // But not both (unless projectRoot is under home, which we skip)
        if (!projectRoot.startsWith(home)) {
          expect(
            !(hasHome && hasProject),
            `${p.name}: ${t.absolutePath} mixes home and project`,
          ).toBe(true)
        }
      }
    }
  })
})

// ============================================================
// path.ts - templatePathToOutputPath for all providers
// ============================================================

describe('templatePathToOutputPath', () => {
  it('claudecode: strips .claude/ prefix, alias = claude', () => {
    expect(templatePathToOutputPath('$HOME/.claude/settings.json', 'claudecode'))
      .toBe('home/claude/settings.json')
    expect(templatePathToOutputPath('$PROJECT/.claude/skills/foo.md', 'claudecode'))
      .toBe('project/claude/skills/foo.md')
  })

  it('opencode: strips .config/opencode/ prefix', () => {
    expect(templatePathToOutputPath('$HOME/.config/opencode/opencode.json', 'opencode'))
      .toBe('home/opencode/opencode.json')
  })

  it('codex: strips .codex/ prefix', () => {
    expect(templatePathToOutputPath('$HOME/.codex/config.toml', 'codex'))
      .toBe('home/codex/config.toml')
    expect(templatePathToOutputPath('$PROJECT/.codex/skills/s.md', 'codex'))
      .toBe('project/codex/skills/s.md')
  })

  it('gemini-cli: strips .gemini/ prefix, alias = gemini', () => {
    expect(templatePathToOutputPath('$HOME/.gemini/settings.json', 'gemini-cli'))
      .toBe('home/gemini/settings.json')
    expect(templatePathToOutputPath('$PROJECT/.gemini/skills/g.md', 'gemini-cli'))
      .toBe('project/gemini/skills/g.md')
  })

  it('kiro: strips .kiro/ prefix', () => {
    expect(templatePathToOutputPath('$HOME/.kiro/settings/mcp.json', 'kiro'))
      .toBe('home/kiro/settings/mcp.json')
    expect(templatePathToOutputPath('$PROJECT/.kiro/steering/guide.md', 'kiro'))
      .toBe('project/kiro/steering/guide.md')
  })

  it('qoder: strips .qoder/ prefix', () => {
    expect(templatePathToOutputPath('$HOME/.qoder/mcp.json', 'qoder'))
      .toBe('home/qoder/mcp.json')
    expect(templatePathToOutputPath('$HOME/.qoder/skills/skill.md', 'qoder'))
      .toBe('home/qoder/skills/skill.md')
  })

  it('cursor: strips .cursor/ prefix', () => {
    expect(templatePathToOutputPath('$HOME/.cursor/mcp.json', 'cursor'))
      .toBe('home/cursor/mcp.json')
    expect(templatePathToOutputPath('$PROJECT/.cursor/rules/style.md', 'cursor'))
      .toBe('project/cursor/rules/style.md')
  })
})
