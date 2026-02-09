import type { ProviderDefinition } from '../providers.js'
import type { SyncItem } from '../types.js'
import fs from 'node:fs/promises'
import { basename, relative } from 'pathe'
import { exists, walkFiles } from './fs.js'
import { toTemplatePath } from './path.js'

const EXCLUDED_BASENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
])

function shouldExclude(filePath: string): boolean {
  const base = basename(filePath)
  if (EXCLUDED_BASENAMES.has(base))
    return true
  if (base.endsWith('.key') || base.endsWith('.pem') || base.endsWith('.p12'))
    return true
  return false
}

export async function discoverSyncItems(
  providers: ProviderDefinition[],
  projectRoot: string,
): Promise<SyncItem[]> {
  const items: SyncItem[] = []

  for (const provider of providers) {
    const targets = provider.targets(projectRoot)
    for (const target of targets) {
      if (!(await exists(target.absolutePath)))
        continue

      if (!target.isDirectory) {
        if (shouldExclude(target.absolutePath))
          continue
        const stat = await fs.stat(target.absolutePath)
        const content = await fs.readFile(target.absolutePath)
        const templatePath = toTemplatePath(target.absolutePath, projectRoot)
        items.push({
          provider: provider.name,
          category: target.category,
          absolutePath: target.absolutePath,
          templatePath,
          relativeLabel: `${provider.name}:${target.label}`,
          content,
          mtimeMs: stat.mtimeMs,
        })
        continue
      }

      const files = await walkFiles(target.absolutePath)
      for (const filePath of files) {
        if (shouldExclude(filePath))
          continue
        const stat = await fs.stat(filePath)
        const content = await fs.readFile(filePath)
        const templatePath = toTemplatePath(filePath, projectRoot)
        const rel = relative(target.absolutePath, filePath)
        items.push({
          provider: provider.name,
          category: target.category,
          absolutePath: filePath,
          templatePath,
          relativeLabel: `${provider.name}:${target.label}/${rel}`,
          content,
          mtimeMs: stat.mtimeMs,
        })
      }
    }
  }

  items.sort((a, b) => a.templatePath.localeCompare(b.templatePath))
  return items
}
