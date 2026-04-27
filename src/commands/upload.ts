import type { GistAuthSource } from '../utils/gist-visibility.js'
import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan, gray, green, red } from 'colorette'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { resolveProviders } from '../providers.js'
import { readUsyncAuth, writeUsyncAuth } from '../utils/auth-store.js'
import { discoverSyncItems } from '../utils/discovery.js'
import { resolveCreateGistVisibility } from '../utils/gist-visibility.js'
import { GistClient } from '../utils/gist.js'
import { authenticateWithGitHubDeviceFlow } from '../utils/github-oauth.js'
import { uploadToGist } from '../utils/sync.js'
import { resolveToken } from '../utils/token.js'

export default defineCommand({
  meta: {
    description: 'Upload discovered files to a GitHub Gist',
  },
  args: {
    token: { type: 'string', alias: 'T', description: 'GitHub PAT (scope: gist write)' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN', description: 'Token env var name' },
    oauth: { type: 'boolean', default: false, description: 'Authenticate with GitHub OAuth device code' },
    githubClientId: { type: 'string', description: 'Override the GitHub OAuth App client ID from build/env/.env' },
    gistId: { type: 'string', alias: 'g', description: 'Existing gist ID' },
    description: { type: 'string', alias: 'd', default: 'cloudSettings', description: 'Gist description' },
    public: { type: 'boolean', alias: 'p', default: false, description: 'Create public gist' },
    providers: { type: 'string', description: 'Filter providers (comma-separated)' },
    cwd: { type: 'string', alias: 'C', description: 'Project root directory' },
    watch: { type: 'boolean', default: false, description: 'Watch for changes' },
    interval: { type: 'string', alias: 'i', default: '15', description: 'Watch interval in seconds' },
  },
  async run({ args }) {
    p.intro(cyan('usync-cli upload'))

    const storedAuth = await readUsyncAuth()
    const resolved = resolveToken(args)
    let token = resolved.token
    let shouldPersistAuth = false
    let authSource: GistAuthSource = 'pat'

    try {
      if (!token && args.oauth) {
        consola.info('Starting GitHub OAuth device flow...')
        const oauthToken = await authenticateWithGitHubDeviceFlow({
          clientId: args.githubClientId,
          onVerification: (verification) => {
            consola.info(`Open ${verification.verificationUri} and enter code: ${cyan(verification.userCode)}`)
          },
        })
        token = oauthToken.accessToken
        shouldPersistAuth = true
        authSource = 'oauth'
      }
      else if (!token && storedAuth?.token) {
        token = storedAuth.token
        shouldPersistAuth = true
        authSource = 'stored'
        consola.info('Using token from usync auth store')
      }
      else if (token) {
        authSource = 'pat'
        consola.info(`Using GitHub token from ${resolved.source}`)
      }
      else {
        throw new Error('GitHub token not found. Pass --token <PAT>, set GITHUB_TOKEN/GH_TOKEN, or run `usync-cli init --oauth`.')
      }
    }
    catch (error) {
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }

    const projectRoot = resolve(args.cwd ?? process.cwd())
    const providers = resolveProviders(args.providers)
    const gistClient = new GistClient(token)
    let targetGistId = args.gistId ?? storedAuth?.gistId

    const s = p.spinner()
    s.start('Authenticating...')

    let user: Awaited<ReturnType<typeof gistClient.getAuthenticatedUser>>
    try {
      user = await gistClient.getAuthenticatedUser()
    }
    catch (error) {
      s.stop('Authentication failed')
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }
    s.stop(`Authenticated as ${cyan(user.login)}`)

    const runUploadOnce = async (): Promise<void> => {
      const items = await discoverSyncItems(providers, projectRoot)
      if (items.length === 0) {
        consola.warn('No local config files found. Nothing to upload.')
        return
      }

      s.start(`Uploading ${items.length} files...`)
      let result: Awaited<ReturnType<typeof uploadToGist>>
      try {
        result = await uploadToGist({
          gistClient,
          gistId: targetGistId,
          description: args.description,
          isPublic: resolveCreateGistVisibility({
            authSource,
            requestedPublic: args.public,
          }),
          localItems: items,
          onProgress: msg => s.message(msg),
        })
      }
      catch (error) {
        s.stop('Upload failed')
        consola.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }
      s.stop(`Gist ${result.created ? 'created' : 'updated'}: ${cyan(result.gistId)}`)
      targetGistId = result.gistId
      if (shouldPersistAuth) {
        await writeUsyncAuth({ token, gistId: result.gistId, login: user.login })
        consola.info('Saved OAuth token and Gist ID to the usync auth store.')
      }

      if (result.plan.changed.length > 0) {
        consola.log(`  ${green(`Uploaded: ${result.plan.changed.length}`)}`)
        for (const item of result.plan.changed) {
          consola.log(`    ${green('+')} ${item.relativeLabel}`)
        }
      }
      if (result.plan.deletedTemplatePaths.length > 0) {
        consola.log(`  ${red(`Deleted: ${result.plan.deletedTemplatePaths.length}`)}`)
        for (const removed of result.plan.deletedTemplatePaths) {
          consola.log(`    ${red('-')} ${removed}`)
        }
      }
      if (result.plan.unchanged.length > 0) {
        consola.log(`  ${gray(`Unchanged: ${result.plan.unchanged.length}`)}`)
      }
    }

    if (!args.watch) {
      await runUploadOnce()
      p.outro('Upload complete!')
      return
    }

    // Watch mode
    const intervalMs = Math.max(3, Number(args.interval || '15')) * 1000
    consola.info(`Watch interval: ${intervalMs / 1000}s`)

    const { createHash } = await import('node:crypto')
    const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

    let stop = false
    process.on('SIGINT', () => {
      stop = true
    })

    let lastFingerprint = ''
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!stop) {
      const items = await discoverSyncItems(providers, projectRoot)
      const fingerprint = createHash('sha256')
        .update(
          items
            .map(item => `${item.templatePath}:${createHash('sha256').update(item.content).digest('hex')}`)
            .join('\n'),
        )
        .digest('hex')

      if (fingerprint !== lastFingerprint) {
        await runUploadOnce()
        lastFingerprint = fingerprint
      }

      await sleep(intervalMs)
    }
    consola.warn('Upload watch stopped.')
  },
})
