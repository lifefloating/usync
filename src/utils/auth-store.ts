import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import process from 'node:process'
import { dirname, join } from 'pathe'

export interface StoredUsyncAuth {
  token?: string
  gistId?: string
  login?: string
}

interface AuthStoreOptions {
  configHome?: string
}

function defaultConfigHome(): string {
  if (process.env.USYNC_CONFIG_HOME)
    return process.env.USYNC_CONFIG_HOME
  if (process.env.XDG_CONFIG_HOME)
    return process.env.XDG_CONFIG_HOME
  if (process.platform === 'win32' && process.env.APPDATA)
    return process.env.APPDATA
  return join(homedir(), '.config')
}

export function getUsyncAuthStorePath(options: AuthStoreOptions = {}): string {
  return join(options.configHome ?? defaultConfigHome(), 'usync', 'auth.json')
}

export async function readUsyncAuth(options: AuthStoreOptions = {}): Promise<StoredUsyncAuth | null> {
  try {
    const parsed = JSON.parse(await readFile(getUsyncAuthStorePath(options), 'utf8')) as StoredUsyncAuth
    if (!parsed.token && !parsed.gistId)
      return null
    return parsed
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null
    throw error
  }
}

export async function writeUsyncAuth(auth: StoredUsyncAuth, options: AuthStoreOptions = {}): Promise<void> {
  const path = getUsyncAuthStorePath(options)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 })
  if (process.platform !== 'win32')
    await chmod(path, 0o600)
}
