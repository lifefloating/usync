import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  getUsyncAuthStorePath,
  readUsyncAuth,
  writeUsyncAuth,
} from '../src/utils/auth-store.js'

describe('usync auth store', () => {
  it('persists OAuth token and gist ID under the configured config home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usync-auth-'))
    const configPath = getUsyncAuthStorePath({ configHome: root })

    await writeUsyncAuth({
      token: 'gho_token',
      gistId: 'gist-123',
      login: 'octocat',
    }, { configHome: root })

    await expect(readUsyncAuth({ configHome: root })).resolves.toEqual({
      token: 'gho_token',
      gistId: 'gist-123',
      login: 'octocat',
    })
    await expect(readFile(configPath, 'utf8')).resolves.toContain('"gistId": "gist-123"')

    if (process.platform !== 'win32') {
      const mode = (await stat(configPath)).mode & 0o777
      expect(mode).toBe(0o600)
    }
  })

  it('returns null when the auth store does not exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usync-auth-missing-'))

    await expect(readUsyncAuth({ configHome: root })).resolves.toBeNull()
  })
})
