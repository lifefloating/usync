import type { ItemCategory, ProviderName } from './types.js'
import os from 'node:os'
import process from 'node:process'
import { join } from 'pathe'

export interface ProviderTarget {
  absolutePath: string
  category: ItemCategory
  isDirectory: boolean
  label: string
}

export interface ProviderDefinition {
  name: ProviderName
  targets: (projectRoot: string) => ProviderTarget[]
}

const home = os.homedir()
const isWindows = process.platform === 'win32'

function t(
  absolutePath: string,
  category: ItemCategory,
  isDirectory: boolean,
  label: string,
): ProviderTarget {
  return { absolutePath, category, isDirectory, label }
}

/**
 * Resolve OpenCode global config directory.
 * - macOS/Linux: ~/.config/opencode/
 * - Windows: %APPDATA%/opencode/ (fallback to ~/.config/opencode/)
 */
function openCodeGlobalDirs(): string[] {
  const dirs = [join(home, '.config', 'opencode')]
  if (isWindows && process.env.APPDATA) {
    dirs.unshift(join(process.env.APPDATA, 'opencode'))
  }
  return dirs
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    name: 'claudecode',
    targets(projectRoot: string) {
      return [
        t(join(home, '.claude', 'settings.json'), 'settings', false, 'global settings'),
        t(join(home, '.claude', 'settings.local.json'), 'settings', false, 'global local settings'),
        t(join(home, '.claude', 'skills'), 'skills', true, 'global skills'),
        t(join(projectRoot, '.claude', 'settings.json'), 'settings', false, 'project settings'),
        t(join(projectRoot, '.claude', 'settings.local.json'), 'settings', false, 'project local settings'),
        t(join(projectRoot, '.claude', 'skills'), 'skills', true, 'project skills'),
      ]
    },
  },
  {
    name: 'opencode',
    targets(projectRoot: string) {
      const dirs = openCodeGlobalDirs()
      const targets: ProviderTarget[] = []
      for (const dir of dirs) {
        targets.push(
          t(join(dir, 'opencode.json'), 'settings', false, 'global config'),
          t(join(dir, 'opencode.jsonc'), 'settings', false, 'global config jsonc'),
          t(join(dir, 'skills'), 'skills', true, 'global skills'),
        )
      }
      targets.push(
        t(join(projectRoot, 'opencode.json'), 'settings', false, 'project opencode.json'),
        t(join(projectRoot, 'opencode.jsonc'), 'settings', false, 'project opencode.jsonc'),
        t(join(projectRoot, '.opencode', 'skills'), 'skills', true, 'project skills'),
      )
      return targets
    },
  },
  {
    name: 'codex',
    targets(projectRoot: string) {
      return [
        t(join(home, '.codex', 'config.json'), 'settings', false, 'global config'),
        t(join(home, '.codex', 'settings.json'), 'settings', false, 'global settings'),
        t(join(home, '.codex', 'skills'), 'skills', true, 'global skills'),
        t(join(projectRoot, '.codex', 'config.json'), 'settings', false, 'project config'),
        t(join(projectRoot, '.codex', 'settings.json'), 'settings', false, 'project settings'),
        t(join(projectRoot, '.codex', 'skills'), 'skills', true, 'project skills'),
      ]
    },
  },
  {
    name: 'gemini-cli',
    targets(projectRoot: string) {
      return [
        t(join(home, '.gemini', 'settings.json'), 'settings', false, 'global settings'),
        t(join(home, '.gemini', 'extensions'), 'other', true, 'global extensions'),
        t(join(home, '.gemini', 'skills'), 'skills', true, 'global skills'),
        t(join(projectRoot, '.gemini', 'settings.json'), 'settings', false, 'project settings'),
        t(join(projectRoot, '.gemini', 'extensions'), 'other', true, 'project extensions'),
        t(join(projectRoot, '.gemini', 'skills'), 'skills', true, 'project skills'),
      ]
    },
  },
]

export function resolveProviders(filter?: string): ProviderDefinition[] {
  if (!filter)
    return PROVIDERS
  const normalized = filter.split(',').map(v => v.trim()).filter(Boolean)
  return PROVIDERS.filter(p => normalized.includes(p.name))
}
