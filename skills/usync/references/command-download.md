# command: download

Download and restore synced files from a GitHub Gist.

## Usage

```bash
usync-cli download --gist-id <id> [options]
```

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--gist-id` | `-g` | **required** | Gist ID to download from |
| `--token` | `-T` | — | GitHub PAT (recommended for private Gists) |
| `--token-env` | | `GITHUB_TOKEN` | Token env var name |
| `--cwd` | `-C` | `process.cwd()` | Project root for resolving `$PROJECT` paths |
| `--output-root` | `-o` | — | Override restore destination (sandbox mode) |
| `--force` | | `false` | Overwrite even if local file is newer |
| `--strict-manifest` | | `false` | Require usync manifest; disable raw fallback |

## Behavior

1. Fetches Gist from GitHub API
2. Parses `usync-manifest.v1.json` for file metadata
3. Decodes base64 content and writes to resolved paths
4. Skips files where local mtime is newer (unless `--force`)

### Raw Gist Fallback

If no manifest is found and `--output-root` is provided, usync falls back to downloading raw Gist files into `<output-root>/raw-gist/`.

## Path Resolution

Template paths in the manifest are resolved:
- `$HOME/...` → User home directory
- `$PROJECT/...` → `--cwd` directory

## Examples

```bash
# Download to original locations
usync-cli download --gist-id abc123

# Download to sandbox directory
usync-cli download --gist-id abc123 --output-root ./sandbox

# Force overwrite local files
usync-cli download --gist-id abc123 --force

# Anonymous access (public Gist)
usync-cli download --gist-id abc123
```
