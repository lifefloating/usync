import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveTemplatePath, templatePathToPortablePath, toTemplatePath } from '../src/utils/path.js'

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
