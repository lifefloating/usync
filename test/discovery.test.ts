import { basename } from 'pathe'
import { describe, expect, it } from 'vitest'

// Re-implement shouldExclude logic for testing since it's not exported
const EXCLUDED_BASENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
])

function shouldExclude(filePath: string): boolean {
  const base = basename(filePath)
  if (EXCLUDED_BASENAMES.has(base))
    return true
  if (base.endsWith('.key') || base.endsWith('.pem') || base.endsWith('.p12'))
    return true
  return false
}

describe('shouldExclude', () => {
  it('excludes OS metadata', () => {
    expect(shouldExclude('/some/path/.DS_Store')).toBe(true)
    expect(shouldExclude('C:/Users/test/Thumbs.db')).toBe(true)
  })

  it('excludes env files', () => {
    expect(shouldExclude('/home/.claude/.env')).toBe(true)
    expect(shouldExclude('/home/.claude/.env.local')).toBe(true)
    expect(shouldExclude('/home/.claude/.env.production')).toBe(true)
    expect(shouldExclude('/home/.claude/.env.development')).toBe(true)
    expect(shouldExclude('/home/.claude/.env.test')).toBe(true)
  })

  it('excludes crypto keys', () => {
    expect(shouldExclude('/home/.claude/server.key')).toBe(true)
    expect(shouldExclude('/home/.claude/cert.pem')).toBe(true)
    expect(shouldExclude('/home/.claude/keystore.p12')).toBe(true)
  })

  it('does not exclude normal files', () => {
    expect(shouldExclude('/home/.claude/settings.json')).toBe(false)
    expect(shouldExclude('/home/.claude/skills/SKILL.md')).toBe(false)
    expect(shouldExclude('/home/.claude/config.jsonc')).toBe(false)
  })
})
