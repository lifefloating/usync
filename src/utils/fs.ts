import fs from 'node:fs/promises'
import { dirname, join } from 'pathe'

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function walkFiles(rootDir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      }
      else if (entry.isFile()) {
        out.push(full)
      }
    }
  }
  await walk(rootDir)
  return out
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true })
}
