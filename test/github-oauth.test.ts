import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authenticateWithGitHubDeviceFlow,
  GITHUB_DEVICE_VERIFICATION_URL,
  resolveGitHubOAuthClientId,
} from '../src/utils/github-oauth.js'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('github device OAuth', () => {
  it('exchanges a user verification code for an access token', async () => {
    const requests: Array<{ url: string, body: string }> = []
    const seenVerification: Array<{ userCode: string, verificationUri: string }> = []
    let tokenPolls = 0

    const token = await authenticateWithGitHubDeviceFlow({
      clientId: 'client-123',
      fetch: async (url, init) => {
        requests.push({ url: String(url), body: String(init?.body ?? '') })

        if (String(url).endsWith('/login/device/code')) {
          return jsonResponse({
            device_code: 'device-abc',
            user_code: 'ABCD-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 600,
            interval: 5,
          })
        }

        tokenPolls += 1
        if (tokenPolls === 1) {
          return jsonResponse({ error: 'authorization_pending' })
        }
        return jsonResponse({
          access_token: 'gho_oauth-token',
          token_type: 'bearer',
          scope: 'gist,read:user',
        })
      },
      now: () => 1_000,
      sleep: async () => {},
      onVerification: info => seenVerification.push({
        userCode: info.userCode,
        verificationUri: info.verificationUri,
      }),
    })

    expect(token).toEqual({
      accessToken: 'gho_oauth-token',
      tokenType: 'bearer',
      scope: 'gist,read:user',
    })
    expect(seenVerification).toEqual([
      { userCode: 'ABCD-1234', verificationUri: GITHUB_DEVICE_VERIFICATION_URL },
    ])
    expect(requests).toHaveLength(3)
    expect(requests[0]).toMatchObject({
      url: 'https://github.com/login/device/code',
      body: 'client_id=client-123&scope=gist+read%3Auser',
    })
    expect(requests[1]).toMatchObject({
      url: 'https://github.com/login/oauth/access_token',
      body: 'client_id=client-123&device_code=device-abc&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code',
    })
  })

  it('uses the OAuth client ID from environment configuration', () => {
    expect(resolveGitHubOAuthClientId({
      env: { USYNC_GITHUB_CLIENT_ID: ' env-client ' },
    })).toBe('env-client')
  })

  it('uses local .env OAuth client ID when process env does not provide one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'usync-oauth-'))
    writeFileSync(join(dir, '.env'), 'USYNC_GITHUB_CLIENT_ID=dotenv-client\n')

    try {
      expect(resolveGitHubOAuthClientId({ env: {}, cwd: dir })).toBe('dotenv-client')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers explicit OAuth client ID over environment configuration', () => {
    expect(resolveGitHubOAuthClientId({
      clientId: ' explicit-client ',
      env: { USYNC_GITHUB_CLIENT_ID: 'env-client' },
    })).toBe('explicit-client')
  })
})
