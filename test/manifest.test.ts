import { describe, expect, it } from 'vitest'
import { parseManifestFromGist } from '../src/utils/sync.js'

function makeGist(files: Record<string, { content: string }>) {
  return {
    id: 'test-id',
    description: 'test',
    updated_at: new Date().toISOString(),
    files: Object.fromEntries(
      Object.entries(files).map(([name, f]) => [name, { ...f, filename: name, raw_url: '' }]),
    ),
  }
}

describe('parseManifestFromGist', () => {
  it('parses valid manifest', () => {
    const manifest = {
      version: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      generator: 'usync@0.1.0',
      items: {
        '$HOME/.claude/settings.json': {
          provider: 'claudecode',
          category: 'settings',
          hash: 'abc123',
          size: 100,
          gistFile: 'usync-item-abc.b64',
        },
      },
    }

    const gist = makeGist({
      'usync-manifest.v1.json': { content: JSON.stringify(manifest) },
    })

    const result = parseManifestFromGist(gist as any)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(1)
    expect(result!.items['$HOME/.claude/settings.json'].provider).toBe('claudecode')
  })

  it('returns null for missing manifest file', () => {
    const gist = makeGist({ 'other-file.txt': { content: 'hello' } })
    expect(parseManifestFromGist(gist as any)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    const gist = makeGist({ 'usync-manifest.v1.json': { content: 'not json' } })
    expect(parseManifestFromGist(gist as any)).toBeNull()
  })

  it('returns null for wrong version', () => {
    const gist = makeGist({
      'usync-manifest.v1.json': { content: JSON.stringify({ version: 2, items: {} }) },
    })
    expect(parseManifestFromGist(gist as any)).toBeNull()
  })

  it('returns null for missing items field', () => {
    const gist = makeGist({
      'usync-manifest.v1.json': { content: JSON.stringify({ version: 1 }) },
    })
    expect(parseManifestFromGist(gist as any)).toBeNull()
  })
})
