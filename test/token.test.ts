import { describe, expect, it } from 'vitest'
import { resolveToken } from '../src/utils/token.js'

describe('resolveToken', () => {
  it('returns --token when provided', () => {
    const result = resolveToken({ token: 'my-token' })
    expect(result.token).toBe('my-token')
    expect(result.source).toBe('--token')
  })

  it('falls back to GITHUB_TOKEN env', () => {
    const prev = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'env-token'
    try {
      const result = resolveToken({})
      expect(result.token).toBe('env-token')
      expect(result.source).toBe('GITHUB_TOKEN')
    }
    finally {
      if (prev === undefined)
        delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = prev
    }
  })

  it('falls back to GH_TOKEN env', () => {
    const prevGH = process.env.GITHUB_TOKEN
    const prevGHT = process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = 'gh-token'
    try {
      const result = resolveToken({})
      expect(result.token).toBe('gh-token')
      expect(result.source).toBe('GH_TOKEN')
    }
    finally {
      if (prevGH === undefined)
        delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = prevGH
      if (prevGHT === undefined)
        delete process.env.GH_TOKEN
      else process.env.GH_TOKEN = prevGHT
    }
  })

  it('returns undefined when no token found', () => {
    const prevGH = process.env.GITHUB_TOKEN
    const prevGHT = process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    try {
      const result = resolveToken({})
      expect(result.token).toBeUndefined()
      expect(result.source).toBe('none')
    }
    finally {
      if (prevGH !== undefined)
        process.env.GITHUB_TOKEN = prevGH
      if (prevGHT !== undefined)
        process.env.GH_TOKEN = prevGHT
    }
  })

  it('uses custom tokenEnv', () => {
    const prev = process.env.MY_TOKEN
    process.env.MY_TOKEN = 'custom-token'
    try {
      const result = resolveToken({ tokenEnv: 'MY_TOKEN' })
      expect(result.token).toBe('custom-token')
      expect(result.source).toBe('MY_TOKEN')
    }
    finally {
      if (prev === undefined)
        delete process.env.MY_TOKEN
      else process.env.MY_TOKEN = prev
    }
  })
})
