import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan, gray, green, red } from 'colorette'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { resolveProviders } from '../providers.js'
import { discoverSyncItems } from '../utils/discovery.js'
import { GistClient } from '../utils/gist.js'
import { uploadToGist } from '../utils/sync.js'
import { ensureToken } from '../utils/token.js'

export default defineCommand({
  meta: {
    description: 'Upload discovered files to a GitHub Gist',
  },
  args: {
    token: { type: 'string', description: 'GitHub PAT (scope: gist write)' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN', description: 'Token env var name' },
    gistId: { type: 'string', description: 'Existing gist ID' },
    description: { type: 'string', default: 'cloudSettings', description: 'Gist description' },
    public: { type: 'boolean', default: false, description: 'Create public gist' },
    providers: { type: 'string', description: 'Filter providers (comma-separated)' },
    cwd: { type: 'string', description: 'Project root directory' },
    watch: { type: 'boolean', default: false, description: 'Watch for changes' },
    interval: { type: 'string', default: '15', description: 'Watch interval in seconds' },
  },
  async run({ args }) {
    p.intro(cyan('usync upload'))

    const token = ensureToken(args)
    const projectRoot = resolve(args.cwd ?? process.cwd())
    const providers = resolveProviders(args.providers)
    const gistClient = new GistClient(token)

    const s = p.spinner()
    s.start('Authenticating...')

    let user: Awaited<ReturnType<typeof gistClient.getAuthenticatedUser>>
    try {
      user = await gistClient.getAuthenticatedUser()
    }
    catch (err: any) {
      s.stop('Authentication failed')
      consola.error(err.message || err)
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
          gistId: args.gistId,
          description: args.description,
          isPublic: args.public,
          localItems: items,
          onProgress: msg => s.message(msg),
        })
      }
      catch (err: any) {
        s.stop('Upload failed')
        consola.error(err.message || err)
        process.exitCode = 1
        return
      }
      s.stop(`Gist ${result.created ? 'created' : 'updated'}: ${cyan(result.gistId)}`)

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
    const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

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
