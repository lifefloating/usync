import process from 'node:process'
import { consola } from 'consola'

interface TokenOptions {
  token?: string
  tokenEnv?: string
}

interface ResolvedToken {
  token?: string
  source: string
}

export function resolveToken(opts: TokenOptions): ResolvedToken {
  if (opts.token)
    return { token: opts.token, source: '--token' }

  const envName = opts.tokenEnv ?? 'GITHUB_TOKEN'
  const fromPreferred = process.env[envName]
  if (fromPreferred)
    return { token: fromPreferred, source: envName }

  const fromGhToken = process.env.GH_TOKEN
  if (fromGhToken)
    return { token: fromGhToken, source: 'GH_TOKEN' }

  return { token: undefined, source: 'none' }
}

export function ensureToken(opts: TokenOptions): string {
  const resolved = resolveToken(opts)
  if (!resolved.token) {
    consola.error('GitHub token not found. Create one at https://github.com/settings/tokens/new (scope: gist), then pass --token <PAT> or set GITHUB_TOKEN/GH_TOKEN.')
    process.exit(1)
  }
  consola.info(`Using GitHub token from ${resolved.source}`)
  return resolved.token
}
