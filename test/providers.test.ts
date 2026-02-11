import { describe, expect, it } from 'vitest'
import { PROVIDERS } from '../src/providers.js'
import { templatePathToOutputPath } from '../src/utils/path.js'

const projectRoot = '/tmp/test-project'

function findProvider(name: string) {
  return PROVIDERS.find(p => p.name === name)!
}

describe('claudecode provider - teams/tasks targets', () => {
  const targets = findProvider('claudecode').targets(projectRoot)
  const teamsTargets = targets.filter(t => t.category === 'teams')

  it('has targets with category "teams"', () => {
    expect(teamsTargets.length).toBeGreaterThanOrEqual(2)
  })

  it('includes a teams directory path', () => {
    expect(teamsTargets.some(t => t.absolutePath.includes('/teams'))).toBe(true)
  })

  it('includes a tasks directory path', () => {
    expect(teamsTargets.some(t => t.absolutePath.includes('/tasks'))).toBe(true)
  })

  it('teams targets are directories', () => {
    for (const t of teamsTargets) {
      expect(t.isDirectory).toBe(true)
    }
  })
})

describe('kiro provider', () => {
  const targets = findProvider('kiro').targets(projectRoot)

  it('has mcp.json as settings target', () => {
    const settings = targets.filter(t => t.category === 'settings')
    expect(settings.some(t => t.absolutePath.endsWith('mcp.json'))).toBe(true)
  })

  it('has steering directory as skills target', () => {
    const skills = targets.filter(t => t.category === 'skills')
    expect(skills.some(t => t.absolutePath.includes('/steering'))).toBe(true)
  })
})

describe('qoder provider', () => {
  const targets = findProvider('qoder').targets(projectRoot)

  it('has global config.json as settings', () => {
    const settings = targets.filter(t => t.category === 'settings')
    expect(settings.some(t => t.absolutePath.includes('.config/qoder/config.json'))).toBe(true)
  })

  it('has global skills directory', () => {
    const skills = targets.filter(t => t.category === 'skills')
    expect(skills.some(t => t.absolutePath.includes('.config/qoder/skills'))).toBe(true)
  })

  it('has project config.json as settings', () => {
    const settings = targets.filter(t => t.category === 'settings')
    expect(settings.some(t => t.absolutePath.includes('.qoder/config.json'))).toBe(true)
  })

  it('has project skills directory', () => {
    const skills = targets.filter(t => t.category === 'skills')
    expect(skills.some(t => t.absolutePath.includes('.qoder/skills'))).toBe(true)
  })
})

describe('path.ts - kiro and qoder mappings', () => {
  it('strips kiro prefix for project paths', () => {
    expect(templatePathToOutputPath('$PROJECT/.kiro/settings/mcp.json', 'kiro'))
      .toBe('project/kiro/settings/mcp.json')
  })

  it('strips kiro prefix for steering paths', () => {
    expect(templatePathToOutputPath('$PROJECT/.kiro/steering/guide.md', 'kiro'))
      .toBe('project/kiro/steering/guide.md')
  })

  it('strips qoder prefix for global paths', () => {
    expect(templatePathToOutputPath('$HOME/.config/qoder/config.json', 'qoder'))
      .toBe('home/qoder/config.json')
  })

  it('strips qoder prefix for global skills', () => {
    expect(templatePathToOutputPath('$HOME/.config/qoder/skills/skill.md', 'qoder'))
      .toBe('home/qoder/skills/skill.md')
  })
})
