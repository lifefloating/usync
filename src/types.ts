export type ProviderName = "claudecode" | "opencode" | "codex" | "gemini-cli";

export type ItemCategory = "settings" | "skills" | "other";

export interface SyncItem {
  provider: ProviderName;
  category: ItemCategory;
  absolutePath: string;
  templatePath: string;
  relativeLabel: string;
  content: Buffer;
  mtimeMs: number;
}

export interface ManifestItem {
  provider: ProviderName;
  category: ItemCategory;
  hash: string;
  size: number;
  gistFile: string;
}

export interface SyncManifest {
  version: 1;
  createdAt: string;
  updatedAt: string;
  generator: string;
  items: Record<string, ManifestItem>;
}

export interface UploadPlan {
  changed: SyncItem[];
  unchanged: SyncItem[];
  deletedTemplatePaths: string[];
}

export interface DownloadResult {
  downloaded: string[];
  skipped: string[];
}
