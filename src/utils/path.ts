import type { ProviderName } from '../types.js'
import os from 'node:os'
import { join, resolve, sep } from 'pathe'

const HOME_TOKEN = '$HOME'
const PROJECT_TOKEN = '$PROJECT'

export function toTemplatePath(absolutePath: string, projectRoot: string): string {
  const normalized = resolve(absolutePath)
  const home = resolve(os.homedir())
  const root = resolve(projectRoot)

  if (normalized.startsWith(`${root}${sep}`) || normalized === root) {
    return normalized.replace(root, PROJECT_TOKEN)
  }
  if (normalized.startsWith(`${home}${sep}`) || normalized === home) {
    return normalized.replace(home, HOME_TOKEN)
  }
  return normalized
}

export function resolveTemplatePath(templatePath: string, projectRoot: string): string {
  const home = resolve(os.homedir())
  const root = resolve(projectRoot)

  if (templatePath.startsWith(HOME_TOKEN)) {
    return resolve(templatePath.replace(HOME_TOKEN, home))
  }
  if (templatePath.startsWith(PROJECT_TOKEN)) {
    return resolve(templatePath.replace(PROJECT_TOKEN, root))
  }
  return resolve(templatePath)
}

function parseTemplatePath(templatePath: string): { scope: string, rest: string } {
  if (templatePath.startsWith(`${HOME_TOKEN}/`))
    return { scope: 'home', rest: templatePath.slice(HOME_TOKEN.length + 1) }
  if (templatePath.startsWith(`${PROJECT_TOKEN}/`))
    return { scope: 'project', rest: templatePath.slice(PROJECT_TOKEN.length + 1) }
  return { scope: 'absolute', rest: templatePath.replace(/^\/+/, '') }
}

export function templatePathToPortablePath(templatePath: string): string {
  const { scope, rest } = parseTemplatePath(templatePath)
  return join(scope, rest)
}

const PROVIDER_PREFIXES: Record<ProviderName, string[]> = {
  'claudecode': ['.claude/'],
  'opencode': ['.config/opencode/', 'AppData/Roaming/opencode/'],
  'codex': ['.codex/'],
  'gemini-cli': ['.gemini/'],
}

const PROVIDER_ALIASES: Record<ProviderName, string> = {
  'claudecode': 'claude',
  'opencode': 'opencode',
  'codex': 'codex',
  'gemini-cli': 'gemini',
}

export function templatePathToOutputPath(templatePath: string, provider: ProviderName): string {
  const { scope, rest } = parseTemplatePath(templatePath)
  const alias = PROVIDER_ALIASES[provider]

  let relative = rest
  for (const prefix of PROVIDER_PREFIXES[provider]) {
    if (relative.startsWith(prefix)) {
      relative = relative.slice(prefix.length)
      break
    }
  }

  return join(scope, alias, relative)
}
