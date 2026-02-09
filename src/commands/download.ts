import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { cyan, gray, green } from 'colorette'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { GistClient } from '../utils/gist.js'
import { downloadFromGist } from '../utils/sync.js'
import { resolveToken } from '../utils/token.js'

export default defineCommand({
  meta: {
    description: 'Download synced files from a GitHub Gist',
  },
  args: {
    gistId: { type: 'string', required: true, description: 'Gist ID' },
    token: { type: 'string', description: 'GitHub PAT' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN', description: 'Token env var name' },
    cwd: { type: 'string', description: 'Project root directory' },
    outputRoot: { type: 'string', description: 'Override restore destination (sandbox path)' },
    force: { type: 'boolean', default: false, description: 'Overwrite even if local is newer' },
    strictManifest: { type: 'boolean', default: false, description: 'Require usync manifest' },
  },
  async run({ args }) {
    p.intro(cyan('usync download'))

    const projectRoot = resolve(args.cwd ?? process.cwd())
    const resolved = resolveToken(args)

    if (resolved.token) {
      consola.info(`Using GitHub token from ${resolved.source}`)
    }
    else {
      consola.warn('No token found, trying anonymous gist access.')
    }

    const gistClient = new GistClient(resolved.token)
    const s = p.spinner()

    s.start('Downloading from gist...')

    let result: Awaited<ReturnType<typeof downloadFromGist>>
    try {
      result = await downloadFromGist({
        gistClient,
        gistId: args.gistId,
        projectRoot,
        outputRoot: args.outputRoot,
        force: args.force,
        allowRawFallback: !args.strictManifest,
      })
    }
    catch (err: any) {
      s.stop('Download failed')
      consola.error(err.message || err)
      process.exitCode = 1
      return
    }
    s.stop('Download complete')

    if (result.downloaded.length > 0) {
      consola.log(`  ${green(`Downloaded: ${result.downloaded.length}`)}`)
      for (const file of result.downloaded) {
        consola.log(`    ${green('+')} ${file}`)
      }
    }
    if (result.skipped.length > 0) {
      consola.log(`  ${gray(`Skipped: ${result.skipped.length}`)}`)
      for (const file of result.skipped) {
        consola.log(`    ${gray('-')} ${file}`)
      }
    }

    p.outro('Done!')
  },
})
