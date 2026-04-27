export { resolveProviders } from './providers.js'

export type {
  DownloadResult,
  ItemCategory,
  ManifestItem,
  ProviderName,
  SyncItem,
  SyncManifest,
  UploadPlan,
} from './types'
export { getUsyncAuthStorePath, readUsyncAuth, writeUsyncAuth } from './utils/auth-store'
export { discoverSyncItems } from './utils/discovery'
export { GistClient } from './utils/gist'
export { authenticateWithGitHubDeviceFlow, pollGitHubDeviceToken, resolveGitHubOAuthClientId, startGitHubDeviceFlow } from './utils/github-oauth'
export { resolveTemplatePath, templatePathToOutputPath, templatePathToPortablePath, toTemplatePath } from './utils/path'
export { buildUploadPlan, downloadFromGist, parseManifestFromGist, uploadToGist } from './utils/sync'
export { ensureToken, resolveToken } from './utils/token'
