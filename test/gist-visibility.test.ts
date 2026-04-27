import { describe, expect, it } from 'vitest'
import { resolveCreateGistVisibility } from '../src/utils/gist-visibility.js'

describe('gist visibility', () => {
  it('forces OAuth-created gists to be private even when public is requested', () => {
    expect(resolveCreateGistVisibility({
      authSource: 'oauth',
      requestedPublic: true,
    })).toBe(false)
  })

  it('forces stored OAuth token-created gists to be private even when public is requested', () => {
    expect(resolveCreateGistVisibility({
      authSource: 'stored',
      requestedPublic: true,
    })).toBe(false)
  })

  it('honors public requests only for PAT-based flows', () => {
    expect(resolveCreateGistVisibility({
      authSource: 'pat',
      requestedPublic: true,
    })).toBe(true)
  })
})
