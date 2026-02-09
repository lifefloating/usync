import type { SyncItem, SyncManifest } from '../src/types.js'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { buildUploadPlan } from '../src/utils/sync.js'

function makeItem(templatePath: string, content: string): SyncItem {
  return {
    provider: 'opencode',
    category: 'settings',
    absolutePath: `/tmp/${Math.random()}`,
    templatePath,
    relativeLabel: templatePath,
    content: Buffer.from(content),
    mtimeMs: Date.now(),
  }
}

describe('buildUploadPlan', () => {
  it('detects changed and deleted items', () => {
    const local = [
      makeItem('$HOME/.opencode/opencode.json', 'a'),
      makeItem('$HOME/.opencode/skills/s1/SKILL.md', 'b'),
    ]

    const remote: SyncManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generator: 'test',
      items: {
        '$HOME/.opencode/opencode.json': {
          provider: 'opencode',
          category: 'settings',
          hash: 'wrong-hash',
          size: 10,
          gistFile: 'a',
        },
        '$HOME/.opencode/deleted.json': {
          provider: 'opencode',
          category: 'settings',
          hash: 'x',
          size: 1,
          gistFile: 'b',
        },
      },
    }

    const plan = buildUploadPlan(local, remote)
    expect(plan.changed.map(item => item.templatePath).sort()).toEqual([
      '$HOME/.opencode/opencode.json',
      '$HOME/.opencode/skills/s1/SKILL.md',
    ])
    expect(plan.deletedTemplatePaths).toEqual(['$HOME/.opencode/deleted.json'])
  })
})
