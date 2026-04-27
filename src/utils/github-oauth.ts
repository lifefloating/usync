import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
export const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_DEVICE_VERIFICATION_URL = 'https://github.com/login/device?skip_account_picker=true'

declare const __USYNC_BUILD_GITHUB_OAUTH_CLIENT_ID__: string | undefined

export interface GitHubOAuthToken {
  accessToken: string
  tokenType: string
  scope?: string
}

export interface GitHubDeviceVerification {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresAt: number
  interval: number
}

interface GitHubDeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval?: number
}

interface GitHubAccessTokenResponse {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

interface TimingOptions {
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
}

function parseDotEnv(content: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0)
      continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key)
      continue

    const value = rawValue
      .replace(/^['"]|['"]$/g, '')
      .replace(/\\n/g, '\n')
    env[key] = value
  }
  return env
}

function readLocalEnv(cwd: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const filename of ['.env', '.env.local']) {
    const filepath = resolve(cwd, filename)
    if (!existsSync(filepath))
      continue
    Object.assign(env, parseDotEnv(readFileSync(filepath, 'utf8')))
  }
  return env
}

function resolveBuildTimeGitHubOAuthClientId(): string | undefined {
  if (typeof __USYNC_BUILD_GITHUB_OAUTH_CLIENT_ID__ === 'undefined')
    return undefined
  return __USYNC_BUILD_GITHUB_OAUTH_CLIENT_ID__
}

export function resolveGitHubOAuthClientId(options: {
  clientId?: string
  env?: NodeJS.ProcessEnv
  cwd?: string
}): string {
  const env = {
    ...readLocalEnv(options.cwd ?? process.cwd()),
    ...(options.env ?? process.env),
  }
  const clientId = [
    options.clientId,
    env.USYNC_GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_ID,
    env.VITE_SYNC_GITHUB_CLIENT_ID,
    resolveBuildTimeGitHubOAuthClientId(),
  ].find(value => value?.trim())

  if (!clientId?.trim()) {
    throw new Error('GitHub OAuth client ID not found. Set USYNC_GITHUB_CLIENT_ID, add it to .env, or pass --github-client-id <client_id>.')
  }

  return clientId.trim()
}

function formatGitHubDeviceVerificationUrl(verificationUri: string): string {
  try {
    const url = new URL(verificationUri)
    url.searchParams.set('skip_account_picker', 'true')
    return url.toString()
  }
  catch {
    return GITHUB_DEVICE_VERIFICATION_URL
  }
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('GitHub OAuth cancelled'))
      return
    }

    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('GitHub OAuth cancelled'))
    }, { once: true })
  })
}

async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${label} failed: ${response.status} ${body}`)
  }
  return (await response.json()) as T
}

export async function startGitHubDeviceFlow(input: {
  clientId: string
  scope?: string
  fetch?: FetchLike
  now?: () => number
  signal?: AbortSignal
}): Promise<GitHubDeviceVerification> {
  const fetchImpl = input.fetch ?? fetch
  const now = input.now ?? Date.now
  const response = await fetchImpl(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    signal: input.signal,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: input.clientId,
      scope: input.scope ?? 'gist read:user',
    }).toString(),
  })
  const data = await readJsonResponse<GitHubDeviceCodeResponse>(response, 'GitHub device flow')

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: formatGitHubDeviceVerificationUrl(data.verification_uri),
    expiresAt: now() + data.expires_in * 1000,
    interval: data.interval ?? 5,
  }
}

export async function pollGitHubDeviceToken(input: {
  clientId: string
  deviceCode: string
  interval: number
  expiresAt: number
  fetch?: FetchLike
} & TimingOptions): Promise<GitHubOAuthToken> {
  const fetchImpl = input.fetch ?? fetch
  const now = input.now ?? Date.now
  const sleep = input.sleep ?? defaultSleep
  let intervalMs = Math.max(input.interval, 5) * 1000

  while (now() < input.expiresAt) {
    await sleep(intervalMs, input.signal)

    const response = await fetchImpl(GITHUB_ACCESS_TOKEN_URL, {
      method: 'POST',
      signal: input.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        device_code: input.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }).toString(),
    })
    const data = await readJsonResponse<GitHubAccessTokenResponse>(response, 'GitHub token polling')

    if (data.access_token) {
      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'bearer',
        scope: data.scope,
      }
    }

    if (data.error === 'authorization_pending')
      continue
    if (data.error === 'slow_down') {
      intervalMs += 5000
      continue
    }
    if (data.error === 'expired_token')
      throw new Error('GitHub device code expired. Please try again.')
    if (data.error === 'access_denied')
      throw new Error('GitHub OAuth authorization was denied.')
    if (data.error)
      throw new Error(`GitHub OAuth error: ${data.error_description ?? data.error}`)
  }

  throw new Error('GitHub device code expired. Please try again.')
}

export async function authenticateWithGitHubDeviceFlow(input: {
  clientId?: string
  scope?: string
  fetch?: FetchLike
  onVerification?: (verification: GitHubDeviceVerification) => void
} & TimingOptions): Promise<GitHubOAuthToken> {
  const clientId = resolveGitHubOAuthClientId({ clientId: input.clientId })
  const verification = await startGitHubDeviceFlow({
    clientId,
    scope: input.scope,
    fetch: input.fetch,
    now: input.now,
    signal: input.signal,
  })
  input.onVerification?.(verification)
  return pollGitHubDeviceToken({
    clientId,
    deviceCode: verification.deviceCode,
    interval: verification.interval,
    expiresAt: verification.expiresAt,
    fetch: input.fetch,
    now: input.now,
    sleep: input.sleep,
    signal: input.signal,
  })
}
