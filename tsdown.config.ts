import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {}
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

    env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
  return env
}

function readBuildEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const filename of ['.env', '.env.local']) {
    const filepath = resolve(process.cwd(), filename)
    if (!existsSync(filepath))
      continue
    Object.assign(env, parseDotEnv(readFileSync(filepath, 'utf8')))
  }
  return {
    ...env,
    ...process.env,
  }
}

const buildEnv = readBuildEnv()
const buildGitHubOAuthClientId = buildEnv.USYNC_GITHUB_CLIENT_ID
  ?? buildEnv.GITHUB_CLIENT_ID
  ?? buildEnv.VITE_SYNC_GITHUB_CLIENT_ID
  ?? ''

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: 'esm',
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  define: {
    __USYNC_BUILD_GITHUB_OAUTH_CLIENT_ID__: JSON.stringify(buildGitHubOAuthClientId),
  },
})
