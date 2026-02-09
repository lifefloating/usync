import process from 'node:process'
import { defineCommand } from 'citty'
import { cyan, gray, green } from 'colorette'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { resolveProviders } from '../providers.js'
import { discoverSyncItems } from '../utils/discovery.js'

export default defineCommand({
  meta: {
    description: 'Scan and list discovered local files',
  },
  args: {
    providers: { type: 'string', description: 'Comma-separated providers: claudecode,opencode,codex,gemini-cli' },
    cwd: { type: 'string', description: 'Project root directory' },
  },
  async run({ args }) {
    const projectRoot = resolve(args.cwd ?? process.cwd())
    const providers = resolveProviders(args.providers)
    const items = await discoverSyncItems(providers, projectRoot)

    if (items.length === 0) {
      consola.warn('No files found for selected providers.')
      return
    }

    consola.log('')
    consola.log(green(`Scan result: ${items.length} files`))
    consola.log('')
    for (const item of items) {
      consola.log(`  ${gray('•')} ${cyan(`[${item.provider}/${item.category}]`)} ${item.absolutePath}`)
    }
  },
})
