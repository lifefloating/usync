import os from "node:os";
import path from "node:path";
import { type ItemCategory, type ProviderName } from "./types.js";

export interface ProviderTarget {
  absolutePath: string;
  category: ItemCategory;
  isDirectory: boolean;
  label: string;
}

export interface ProviderDefinition {
  name: ProviderName;
  targets(projectRoot: string): ProviderTarget[];
}

const home = os.homedir();

function t(
  absolutePath: string,
  category: ItemCategory,
  isDirectory: boolean,
  label: string,
): ProviderTarget {
  return { absolutePath, category, isDirectory, label };
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    name: "claudecode",
    targets(projectRoot: string) {
      return [
        t(path.join(home, ".claude", "settings.json"), "settings", false, "global settings"),
        t(path.join(home, ".claude", "settings.local.json"), "settings", false, "global local settings"),
        t(path.join(home, ".claude", "skills"), "skills", true, "global skills"),
        t(path.join(projectRoot, ".claude", "settings.json"), "settings", false, "project settings"),
        t(path.join(projectRoot, ".claude", "settings.local.json"), "settings", false, "project local settings"),
        t(path.join(projectRoot, ".claude", "skills"), "skills", true, "project skills"),
      ];
    },
  },
  {
    name: "opencode",
    targets(projectRoot: string) {
      return [
        t(path.join(home, ".config", "opencode", "opencode.json"), "settings", false, "global config"),
        t(path.join(home, ".config", "opencode", "opencode.jsonc"), "settings", false, "global config jsonc"),
        t(path.join(home, ".config", "opencode", "skills"), "skills", true, "global skills"),
        t(path.join(projectRoot, "opencode.json"), "settings", false, "project opencode.json"),
        t(path.join(projectRoot, "opencode.jsonc"), "settings", false, "project opencode.jsonc"),
        t(path.join(projectRoot, ".opencode", "skills"), "skills", true, "project skills"),
      ];
    },
  },
  {
    name: "codex",
    targets(projectRoot: string) {
      return [
        t(path.join(home, ".codex", "config.json"), "settings", false, "global config"),
        t(path.join(home, ".codex", "settings.json"), "settings", false, "global settings"),
        t(path.join(home, ".codex", "skills"), "skills", true, "global skills"),
        t(path.join(projectRoot, ".codex", "config.json"), "settings", false, "project config"),
        t(path.join(projectRoot, ".codex", "settings.json"), "settings", false, "project settings"),
        t(path.join(projectRoot, ".codex", "skills"), "skills", true, "project skills"),
      ];
    },
  },
  {
    name: "gemini-cli",
    targets(projectRoot: string) {
      return [
        t(path.join(home, ".gemini", "settings.json"), "settings", false, "global settings"),
        t(path.join(home, ".gemini", "extensions"), "other", true, "global extensions"),
        t(path.join(home, ".gemini", "skills"), "skills", true, "global skills"),
        t(path.join(projectRoot, ".gemini", "settings.json"), "settings", false, "project settings"),
        t(path.join(projectRoot, ".gemini", "extensions"), "other", true, "project extensions"),
        t(path.join(projectRoot, ".gemini", "skills"), "skills", true, "project skills"),
      ];
    },
  },
];

export function resolveProviders(filter?: string): ProviderDefinition[] {
  if (!filter) return PROVIDERS;
  const normalized = filter.split(",").map((v) => v.trim()).filter(Boolean);
  return PROVIDERS.filter((p) => normalized.includes(p.name));
}
