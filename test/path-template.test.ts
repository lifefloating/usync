import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveTemplatePath, templatePathToOutputPath, templatePathToPortablePath, toTemplatePath } from '../src/utils/path.js'

describe('path template', () => {
  it('maps project paths to $PROJECT token', () => {
    const project = '/tmp/work/project'
    const absolute = '/tmp/work/project/.opencode/skills/a/SKILL.md'
    expect(toTemplatePath(absolute, project)).toBe('$PROJECT/.opencode/skills/a/SKILL.md')
  })

  it('resolves project token back', () => {
    const project = '/tmp/work/project'
    expect(resolveTemplatePath('$PROJECT/.codex/settings.json', project)).toBe(
      resolve('/tmp/work/project/.codex/settings.json'),
    )
  })

  it('portable path keeps bucket prefixes', () => {
    expect(templatePathToPortablePath('$HOME/.claude/settings.json')).toBe('home/.claude/settings.json')
    expect(templatePathToPortablePath('$PROJECT/.gemini/settings.json')).toBe('project/.gemini/settings.json')
  })
})

describe('templatePathToOutputPath', () => {
  it('strips claudecode prefix and uses alias', () => {
    expect(templatePathToOutputPath('$HOME/.claude/settings.json', 'claudecode'))
      .toBe('home/claude/settings.json')
  })

  it('strips opencode .config prefix', () => {
    expect(templatePathToOutputPath('$HOME/.config/opencode/opencode.json', 'opencode'))
      .toBe('home/opencode/opencode.json')
  })

  it('strips opencode Windows AppData prefix', () => {
    expect(templatePathToOutputPath('$HOME/AppData/Roaming/opencode/opencode.json', 'opencode'))
      .toBe('home/opencode/opencode.json')
  })

  it('strips codex prefix', () => {
    expect(templatePathToOutputPath('$HOME/.codex/config.json', 'codex'))
      .toBe('home/codex/config.json')
  })

  it('strips gemini prefix and uses alias', () => {
    expect(templatePathToOutputPath('$HOME/.gemini/settings.json', 'gemini-cli'))
      .toBe('home/gemini/settings.json')
  })

  it('handles project scope', () => {
    expect(templatePathToOutputPath('$PROJECT/.claude/skills/foo.md', 'claudecode'))
      .toBe('project/claude/skills/foo.md')
  })

  it('keeps path when prefix does not match', () => {
    expect(templatePathToOutputPath('$HOME/custom/path.json', 'claudecode'))
      .toBe('home/claude/custom/path.json')
  })
})
