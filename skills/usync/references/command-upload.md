# command: upload

Upload discovered config files to a GitHub Gist. Supports incremental sync and watch mode.

## Usage

```bash
usync-cli upload [options]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--token` | string | — | GitHub PAT (scope: gist write) |
| `--token-env` | string | `GITHUB_TOKEN` | Token env var name |
| `--gist-id` | string | — | Existing Gist ID; creates new if omitted |
| `--description` | string | `cloudSettings` | Gist description |
| `--public` | boolean | `false` | Create public Gist |
| `--providers` | string | — | Filter providers (comma-separated) |
| `--cwd` | string | `process.cwd()` | Project root directory |
| `--watch` | boolean | `false` | Watch for changes and auto-upload |
| `--interval` | string | `15` | Watch polling interval in seconds |

## Incremental Sync

Upload uses a manifest (`usync-manifest.v1.json`) stored in the Gist to track file hashes. Only changed files are uploaded on subsequent runs:

- **Changed** — Files with different content hash
- **Deleted** — Files in manifest that no longer exist locally
- **Unchanged** — Files with matching hash (skipped)

## Watch Mode

With `--watch`, usync-cli polls for local changes and auto-uploads:

```bash
usync-cli upload --gist-id <id> --watch --interval 30
```

- Computes SHA-256 fingerprint of all discovered files
- Uploads only when fingerprint changes
- Minimum interval: 3 seconds
- Stop with Ctrl+C (SIGINT)

## Examples

```bash
# Upload to existing Gist
usync-cli upload --gist-id abc123

# Create new Gist and upload
usync-cli upload

# Upload only ClaudeCode configs
usync-cli upload --gist-id abc123 --providers claudecode

# Watch mode with 30s interval
usync-cli upload --gist-id abc123 --watch --interval 30
```
