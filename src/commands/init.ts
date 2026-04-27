import type { GistAuthSource } from '../utils/gist-visibility.js'
import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan } from 'colorette'
import { consola } from 'consola'
import { readUsyncAuth, writeUsyncAuth } from '../utils/auth-store.js'
import { resolveCreateGistVisibility } from '../utils/gist-visibility.js'
import { GistClient } from '../utils/gist.js'
import { authenticateWithGitHubDeviceFlow } from '../utils/github-oauth.js'
import { resolveToken } from '../utils/token.js'

export default defineCommand({
  meta: {
    description: 'Validate token and gist access, optionally create a new gist',
  },
  args: {
    token: { type: 'string', alias: 'T', description: 'GitHub PAT' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN', description: 'Token env var name' },
    oauth: { type: 'boolean', default: false, description: 'Authenticate with GitHub OAuth device code' },
    githubClientId: { type: 'string', description: 'Override the GitHub OAuth App client ID from build/env/.env' },
    gistId: { type: 'string', alias: 'g', description: 'Existing gist ID to verify access' },
    description: { type: 'string', alias: 'd', default: 'cloudSettings', description: 'Description for new gist' },
    public: { type: 'boolean', alias: 'p', default: false, description: 'Create public gist' },
  },
  async run({ args }) {
    p.intro(cyan('usync-cli init'))

    // Resolve token — interactive prompt if not provided
    const storedAuth = await readUsyncAuth()
    const resolved = resolveToken(args)
    let token = resolved.token
    let shouldPersistAuth = false
    let authSource: GistAuthSource = 'pat'
    if (!token && args.oauth) {
      try {
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
      catch (error) {
        consola.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }
    }
    else if (!token && storedAuth?.token) {
      token = storedAuth.token
      shouldPersistAuth = true
      authSource = 'stored'
      consola.info('Using token from usync auth store')
    }
    else if (!token) {
      if (!process.stdout.isTTY || process.env.CI) {
        consola.error('GitHub token not found. Pass --token <PAT>, set GITHUB_TOKEN/GH_TOKEN, or run `usync-cli init --oauth`.')
        process.exitCode = 1
        return
      }

      const input = await p.password({
        message: 'Enter your GitHub Personal Access Token:',
        validate: (v) => {
          if (!v)
            return 'Token is required'
        },
      })
      if (p.isCancel(input)) {
        p.outro('Cancelled.')
        return
      }
      token = input
      authSource = 'pat'
    }
    else {
      authSource = 'pat'
      consola.info(`Using token from ${resolved.source}`)
    }

    const gistClient = new GistClient(token)
    const s = p.spinner()

    // Verify token
    s.start('Verifying token...')
    try {
      const user = await gistClient.getAuthenticatedUser()
      s.stop(`Token verified — ${cyan(user.login)}`)
    }
    catch (error) {
      s.stop('Token verification failed')
      consola.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return
    }

    // Resolve gist ID — interactive if not provided
    let gistId = args.gistId ?? storedAuth?.gistId
    if (!gistId && process.stdout.isTTY && !process.env.CI) {
      const choice = await p.select({
        message: 'Do you have an existing Gist ID?',
        options: [
          { value: 'existing', label: 'Yes, enter Gist ID' },
          { value: 'create', label: 'No, create a new one' },
        ],
      })
      if (p.isCancel(choice)) {
        p.outro('Cancelled.')
        return
      }

      if (choice === 'existing') {
        const id = await p.text({
          message: 'Enter your Gist ID:',
          validate: v => !v ? 'Gist ID is required' : undefined,
        })
        if (p.isCancel(id)) {
          p.outro('Cancelled.')
          return
        }
        gistId = id
      }
    }

    let finalGistId: string
    if (gistId) {
      s.start('Verifying gist access...')
      try {
        const gist = await gistClient.getGist(gistId)
        finalGistId = gist.id
        s.stop(`Gist accessible: ${cyan(gist.id)}`)
        consola.info(`Description: ${gist.description ?? 'no description'}`)
      }
      catch (error) {
        s.stop('Gist verification failed')
        consola.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }
    }
    else {
      s.start('Creating new gist...')
      try {
        const gist = await gistClient.createGist({
          description: args.description,
          isPublic: resolveCreateGistVisibility({
            authSource,
            requestedPublic: args.public,
          }),
          files: {
            'usync-init.txt': { content: `initialized at ${new Date().toISOString()}` },
          },
        })
        finalGistId = gist.id
        s.stop(`Created gist: ${cyan(gist.id)}`)
        consola.info(`URL: https://gist.github.com/${gist.id}`)
      }
      catch (error) {
        s.stop('Gist creation failed')
        consola.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
        return
      }
    }

    if (shouldPersistAuth) {
      await writeUsyncAuth({ ...storedAuth, token, gistId: finalGistId })
      consola.info('Saved OAuth token and Gist ID to the usync auth store.')
    }

    p.outro('Init complete! Run `usync-cli upload` to start syncing.')
  },
})
