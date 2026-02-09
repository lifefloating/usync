import type { DownloadResult, ManifestItem, SyncItem, SyncManifest, UploadPlan } from '../types.js'
import type { GistClient, GistResponse } from './gist.js'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { ensureParentDir } from './fs.js'
import { resolveTemplatePath } from './path.js'

export const MANIFEST_FILENAME = 'usync-manifest.v1.json'

function templatePathToVisibleOutputPath(templatePath: string, provider: ManifestItem['provider']): string {
  const scope = templatePath.startsWith('$HOME/')
    ? 'home'
    : templatePath.startsWith('$PROJECT/')
      ? 'project'
      : 'absolute'

  const withoutToken = templatePath
    .replace(/^\$HOME\//, '')
    .replace(/^\$PROJECT\//, '')
    .replace(/^\//, '')

  const providerAlias
    = provider === 'claudecode'
      ? 'claude'
      : provider === 'gemini-cli'
        ? 'gemini'
        : provider

  let relative = withoutToken
  if (provider === 'claudecode' && relative.startsWith('.claude/'))
    relative = relative.slice('.claude/'.length)
  if (provider === 'opencode' && relative.startsWith('.config/opencode/'))
    relative = relative.slice('.config/opencode/'.length)
  if (provider === 'gemini-cli' && relative.startsWith('.gemini/'))
    relative = relative.slice('.gemini/'.length)
  if (provider === 'codex' && relative.startsWith('.codex/'))
    relative = relative.slice('.codex/'.length)

  return join(scope, providerAlias, relative)
}

function sha256(buffer: Buffer | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function gistFilenameForTemplatePath(templatePath: string): string {
  const short = sha256(templatePath).slice(0, 24)
  return `usync-item-${short}.b64`
}

export function parseManifestFromGist(gist: GistResponse): SyncManifest | null {
  const content = gist.files[MANIFEST_FILENAME]?.content
  if (!content)
    return null
  try {
    const parsed = JSON.parse(content) as SyncManifest
    if (parsed.version !== 1 || !parsed.items)
      return null
    return parsed
  }
  catch {
    return null
  }
}

export function buildUploadPlan(localItems: SyncItem[], remoteManifest: SyncManifest | null): UploadPlan {
  const changed: SyncItem[] = []
  const unchanged: SyncItem[] = []
  const localMap = new Map(localItems.map(item => [item.templatePath, item]))
  const remoteItems = remoteManifest?.items ?? {}

  for (const item of localItems) {
    const localHash = sha256(item.content)
    const remote = remoteItems[item.templatePath]
    if (!remote || remote.hash !== localHash)
      changed.push(item)
    else
      unchanged.push(item)
  }

  const deletedTemplatePaths = Object.keys(remoteItems).filter(templatePath => !localMap.has(templatePath))
  return { changed, unchanged, deletedTemplatePaths }
}

function buildManifest(items: SyncItem[], previousManifest: SyncManifest | null): SyncManifest {
  const now = new Date().toISOString()
  const baseCreatedAt = previousManifest?.createdAt ?? now
  const mappedItems: Record<string, ManifestItem> = {}
  for (const item of items) {
    mappedItems[item.templatePath] = {
      provider: item.provider,
      category: item.category,
      hash: sha256(item.content),
      size: item.content.byteLength,
      gistFile: gistFilenameForTemplatePath(item.templatePath),
    }
  }

  return {
    version: 1,
    createdAt: baseCreatedAt,
    updatedAt: now,
    generator: 'usync-cli@0.1.0',
    items: mappedItems,
  }
}

export async function uploadToGist(input: {
  gistClient: GistClient
  gistId?: string
  description: string
  isPublic: boolean
  localItems: SyncItem[]
  onProgress?: (current: number, total: number, label: string) => void
}): Promise<{ gistId: string, plan: UploadPlan, created: boolean }> {
  let gist: GistResponse | null = null
  let created = false

  if (input.gistId) {
    gist = await input.gistClient.getGist(input.gistId)
  }

  const remoteManifest = gist ? parseManifestFromGist(gist) : null
  const plan = buildUploadPlan(input.localItems, remoteManifest)
  const nextManifest = buildManifest(input.localItems, remoteManifest)

  const filesPatch: Record<string, { content: string } | null> = {}
  const changedCount = plan.changed.length + plan.deletedTemplatePaths.length + 1
  let progress = 0

  for (const item of plan.changed) {
    const gistFile = nextManifest.items[item.templatePath].gistFile
    filesPatch[gistFile] = { content: item.content.toString('base64') }
    progress += 1
    input.onProgress?.(progress, changedCount, `upload ${item.relativeLabel}`)
  }

  for (const templatePath of plan.deletedTemplatePaths) {
    const oldGistFile = remoteManifest?.items[templatePath]?.gistFile
    if (oldGistFile)
      filesPatch[oldGistFile] = null
    progress += 1
    input.onProgress?.(progress, changedCount, `delete ${templatePath}`)
  }

  filesPatch[MANIFEST_FILENAME] = {
    content: JSON.stringify(nextManifest, null, 2),
  }
  progress += 1
  input.onProgress?.(progress, changedCount, 'upload manifest')

  if (!gist) {
    const createdGist = await input.gistClient.createGist({
      description: input.description,
      isPublic: input.isPublic,
      files: Object.fromEntries(
        Object.entries(filesPatch)
          .filter(([, value]) => value !== null)
          .map(([k, v]) => [k, v as { content: string }]),
      ),
    })
    created = true
    return { gistId: createdGist.id, plan, created }
  }

  await input.gistClient.updateGist(gist.id, {
    description: input.description,
    files: filesPatch,
  })

  return { gistId: gist.id, plan, created }
}

export async function downloadFromGist(input: {
  gistClient: GistClient
  gistId: string
  projectRoot: string
  outputRoot?: string
  force?: boolean
  allowRawFallback?: boolean
  onProgress?: (current: number, total: number, label: string) => void
}): Promise<DownloadResult> {
  const gist = await input.gistClient.getGist(input.gistId)
  const manifest = parseManifestFromGist(gist)
  if (!manifest) {
    if (!input.allowRawFallback || !input.outputRoot) {
      throw new Error(`Manifest file ${MANIFEST_FILENAME} not found in gist ${input.gistId}`)
    }

    const downloaded: string[] = []
    const skipped: string[] = []
    const entries = Object.entries(gist.files)
    let progress = 0
    for (const [fileName, gistFile] of entries) {
      if (!gistFile.content && !gistFile.raw_url) {
        skipped.push(`${fileName} (missing gist content)`)
        progress += 1
        input.onProgress?.(progress, entries.length, `skip ${fileName}`)
        continue
      }

      let content = gistFile.content
      if (!content && gistFile.raw_url) {
        const rawResp = await fetch(gistFile.raw_url)
        if (!rawResp.ok) {
          skipped.push(`${fileName} (failed to fetch raw gist file)`)
          progress += 1
          input.onProgress?.(progress, entries.length, `skip ${fileName}`)
          continue
        }
        content = await rawResp.text()
      }

      if (!content) {
        skipped.push(`${fileName} (missing gist content)`)
        progress += 1
        input.onProgress?.(progress, entries.length, `skip ${fileName}`)
        continue
      }

      const targetPath = join(resolve(input.outputRoot), 'raw-gist', fileName)
      await ensureParentDir(targetPath)
      await fs.writeFile(targetPath, Buffer.from(content, 'utf8'))
      downloaded.push(targetPath)
      progress += 1
      input.onProgress?.(progress, entries.length, `download ${targetPath}`)
    }

    return { downloaded, skipped }
  }

  const downloaded: string[] = []
  const skipped: string[] = []
  const entries = Object.entries(manifest.items)
  let progress = 0

  for (const [templatePath, itemMeta] of entries) {
    const gistFile = gist.files[itemMeta.gistFile]
    if (!gistFile) {
      skipped.push(`${templatePath} (missing gist content)`)
      progress += 1
      input.onProgress?.(progress, entries.length, `skip ${templatePath}`)
      continue
    }

    let encoded = gistFile.content
    if (!encoded && gistFile.raw_url) {
      const rawResp = await fetch(gistFile.raw_url)
      if (!rawResp.ok) {
        skipped.push(`${templatePath} (failed to fetch raw gist file)`)
        progress += 1
        input.onProgress?.(progress, entries.length, `skip ${templatePath}`)
        continue
      }
      encoded = await rawResp.text()
    }
    if (!encoded) {
      skipped.push(`${templatePath} (missing gist content)`)
      progress += 1
      input.onProgress?.(progress, entries.length, `skip ${templatePath}`)
      continue
    }

    const content = Buffer.from(encoded, 'base64')
    let targetPath: string
    if (input.outputRoot) {
      targetPath = join(
        resolve(input.outputRoot),
        templatePathToVisibleOutputPath(templatePath, itemMeta.provider),
      )
    }
    else {
      targetPath = resolveTemplatePath(templatePath, input.projectRoot)
    }

    if (!input.force) {
      try {
        const current = await fs.stat(targetPath)
        if (current.mtimeMs > Date.parse(gist.updated_at)) {
          skipped.push(`${targetPath} (local newer than gist)`)
          progress += 1
          input.onProgress?.(progress, entries.length, `skip ${targetPath}`)
          continue
        }
      }
      catch {
        // File does not exist yet.
      }
    }

    await ensureParentDir(targetPath)
    await fs.writeFile(targetPath, content)
    downloaded.push(targetPath)
    progress += 1
    input.onProgress?.(progress, entries.length, `download ${targetPath}`)
  }

  return { downloaded, skipped }
}
