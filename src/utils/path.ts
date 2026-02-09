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

export function templatePathToPortablePath(templatePath: string): string {
  if (templatePath.startsWith(HOME_TOKEN)) {
    return join('home', templatePath.slice(HOME_TOKEN.length))
  }
  if (templatePath.startsWith(PROJECT_TOKEN)) {
    return join('project', templatePath.slice(PROJECT_TOKEN.length))
  }
  return join('absolute', templatePath.replace(/^\/+/, ''))
}
