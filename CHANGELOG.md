# usync-cli

## 1.2.1

### Patch Changes

- 144d332: Add `repository`, `homepage`, and `bugs` fields to package.json so that npm OIDC provenance verification can match the GitHub source repo.

## 1.2.0

### Minor Changes

- cebf68b: Rename package to `usync-cli` and switch to npm Trusted Publisher (OIDC) for releases.

## 1.1.2

### Patch Changes

- Replace timestamp comparison with content hash comparison in download, consistent with upload behavior
