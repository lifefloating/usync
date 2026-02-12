import type { DownloadResult, ManifestItem, SyncItem, SyncManifest, UploadPlan } from '../types.js'
import type { GistClient, GistResponse } from './gist.js'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { version } from '../../package.json'
import { ensureParentDir } from './fs.js'
import { resolveTemplatePath, templatePathToOutputPath } from './path.js'

export const MANIFEST_FILENAME = 'usync-manifest.v1.json'

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
    generator: `usync-cli@${version}`,
    items: mappedItems,
  }
}

export async function uploadToGist(input: {
  gistClient: GistClient
  gistId?: string
  description: string
  isPublic: boolean
  localItems: SyncItem[]
  onProgress?: (message: string) => void
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
  const total = plan.changed.length + plan.deletedTemplatePaths.length

  for (let i = 0; i < plan.changed.length; i++) {
    const item = plan.changed[i]
    input.onProgress?.(`Preparing ${i + 1}/${total}: ${item.relativeLabel}`)
    const gistFile = nextManifest.items[item.templatePath].gistFile
    filesPatch[gistFile] = { content: item.content.toString('base64') }
  }

  for (let i = 0; i < plan.deletedTemplatePaths.length; i++) {
    const templatePath = plan.deletedTemplatePaths[i]
    input.onProgress?.(`Deleting ${plan.changed.length + i + 1}/${total}: ${templatePath}`)
    const oldGistFile = remoteManifest?.items[templatePath]?.gistFile
    if (oldGistFile)
      filesPatch[oldGistFile] = null
  }

  filesPatch[MANIFEST_FILENAME] = {
    content: JSON.stringify(nextManifest, null, 2),
  }

  input.onProgress?.(`Pushing to gist...`)

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
  onProgress?: (message: string) => void
}): Promise<DownloadResult> {
  const gist = await input.gistClient.getGist(input.gistId)

  // GitHub API truncates file content for large gists — fetch manifest via raw_url if needed
  const manifestFile = gist.files[MANIFEST_FILENAME]
  if (manifestFile && !manifestFile.content && manifestFile.raw_url) {
    const rawResp = await fetch(manifestFile.raw_url)
    if (rawResp.ok) {
      manifestFile.content = await rawResp.text()
    }
  }

  const manifest = parseManifestFromGist(gist)
  if (!manifest) {
    if (!input.allowRawFallback) {
      throw new Error(`Manifest file ${MANIFEST_FILENAME} not found in gist ${input.gistId}`)
    }

    const rawOutputRoot = input.outputRoot ? resolve(input.outputRoot) : input.projectRoot
    const downloaded: string[] = []
    const skipped: string[] = []
    const entries = Object.entries(gist.files)
    for (let i = 0; i < entries.length; i++) {
      const [fileName, gistFile] = entries[i]
      input.onProgress?.(`Downloading ${i + 1}/${entries.length}: ${fileName}`)
      if (!gistFile.content && !gistFile.raw_url) {
        skipped.push(`${fileName} (missing gist content)`)
        continue
      }

      let content = gistFile.content
      if (!content && gistFile.raw_url) {
        const rawResp = await fetch(gistFile.raw_url)
        if (!rawResp.ok) {
          skipped.push(`${fileName} (failed to fetch raw gist file)`)
          continue
        }
        content = await rawResp.text()
      }

      if (!content) {
        skipped.push(`${fileName} (missing gist content)`)
        continue
      }

      const targetPath = join(rawOutputRoot, 'raw-gist', fileName)
      await ensureParentDir(targetPath)
      await fs.writeFile(targetPath, Buffer.from(content, 'utf8'))
      downloaded.push(targetPath)
    }

    return { downloaded, skipped }
  }

  const downloaded: string[] = []
  const skipped: string[] = []
  const entries = Object.entries(manifest.items)

  for (let i = 0; i < entries.length; i++) {
    const [templatePath, itemMeta] = entries[i]
    input.onProgress?.(`Restoring ${i + 1}/${entries.length}: ${templatePath}`)
    const gistFile = gist.files[itemMeta.gistFile]
    if (!gistFile) {
      skipped.push(`${templatePath} (missing gist content)`)
      continue
    }

    let encoded = gistFile.content
    if (!encoded && gistFile.raw_url) {
      const rawResp = await fetch(gistFile.raw_url)
      if (!rawResp.ok) {
        skipped.push(`${templatePath} (failed to fetch raw gist file)`)
        continue
      }
      encoded = await rawResp.text()
    }
    if (!encoded) {
      skipped.push(`${templatePath} (missing gist content)`)
      continue
    }

    const content = Buffer.from(encoded, 'base64')
    let targetPath: string
    if (input.outputRoot) {
      targetPath = join(
        resolve(input.outputRoot),
        templatePathToOutputPath(templatePath, itemMeta.provider),
      )
    }
    else {
      targetPath = resolveTemplatePath(templatePath, input.projectRoot)
    }

    if (!input.force) {
      try {
        const localContent = await fs.readFile(targetPath)
        if (sha256(localContent) === itemMeta.hash) {
          skipped.push(`${targetPath} (unchanged)`)
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
  }

  return { downloaded, skipped }
}
