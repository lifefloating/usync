import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan } from 'colorette'
import { consola } from 'consola'
import { GistClient } from '../utils/gist.js'
import { resolveToken } from '../utils/token.js'

export default defineCommand({
  meta: {
    description: 'Validate token and gist access, optionally create a new gist',
  },
  args: {
    token: { type: 'string', description: 'GitHub PAT' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN', description: 'Token env var name' },
    gistId: { type: 'string', description: 'Existing gist ID to verify access' },
    description: { type: 'string', default: 'cloudSettings', description: 'Description for new gist' },
    public: { type: 'boolean', default: false, description: 'Create public gist' },
  },
  async run({ args }) {
    p.intro(cyan('usync init'))

    // Resolve token — interactive prompt if not provided
    let token = resolveToken(args).token
    if (!token) {
      if (!process.stdout.isTTY || process.env.CI) {
        consola.error('GitHub token not found. Pass --token <PAT> or set GITHUB_TOKEN/GH_TOKEN.')
        process.exit(1)
      }

      const input = await p.password({
        message: 'Enter your GitHub Personal Access Token:',
        validate: (v) => {
          if (!v)
            return 'Token is required'
        },
      })
      if (p.isCancel(input))
        process.exit(0)
      token = input
    }
    else {
      consola.info(`Using token from ${resolveToken(args).source}`)
    }

    const gistClient = new GistClient(token)
    const s = p.spinner()

    // Verify token
    s.start('Verifying token...')
    const user = await gistClient.getAuthenticatedUser()
    s.stop(`Token verified — ${cyan(user.login)}`)

    // Resolve gist ID — interactive if not provided
    let gistId = args.gistId
    if (!gistId && process.stdout.isTTY && !process.env.CI) {
      const choice = await p.select({
        message: 'Do you have an existing Gist ID?',
        options: [
          { value: 'existing', label: 'Yes, enter Gist ID' },
          { value: 'create', label: 'No, create a new one' },
        ],
      })
      if (p.isCancel(choice))
        process.exit(0)

      if (choice === 'existing') {
        const id = await p.text({
          message: 'Enter your Gist ID:',
          validate: v => !v ? 'Gist ID is required' : undefined,
        })
        if (p.isCancel(id))
          process.exit(0)
        gistId = id
      }
    }

    if (gistId) {
      s.start('Verifying gist access...')
      const gist = await gistClient.getGist(gistId)
      s.stop(`Gist accessible: ${cyan(gist.id)}`)
      consola.info(`Description: ${gist.description ?? 'no description'}`)
    }
    else {
      s.start('Creating new gist...')
      const gist = await gistClient.createGist({
        description: args.description,
        isPublic: args.public,
        files: {
          'usync-init.txt': { content: `initialized at ${new Date().toISOString()}` },
        },
      })
      s.stop(`Created gist: ${cyan(gist.id)}`)
      consola.info(`URL: https://gist.github.com/${gist.id}`)
    }

    p.outro('Init complete! Run `usync upload` to start syncing.')
  },
})
