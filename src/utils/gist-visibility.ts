export type GistAuthSource = 'pat' | 'oauth' | 'stored'

export function resolveCreateGistVisibility(input: {
  authSource: GistAuthSource
  requestedPublic?: boolean
}): boolean {
  if (input.authSource === 'oauth' || input.authSource === 'stored')
    return false
  return input.requestedPublic === true
}
