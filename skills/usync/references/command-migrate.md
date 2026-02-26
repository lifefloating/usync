# command: migrate

Migrate MCP configs and skills between AI coding tools with automatic format conversion.

## Usage

```bash
usync migrate --from <provider> --to <provider> [options]
```

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--from` | `-f` | — | Source provider |
| `--to` | `-t` | — | Target provider |
| `--scope` | `-s` | `global` | Migration scope: `global` or `project` |
| `--cwd` | `-C` | `process.cwd()` | Project root directory (for project scope) |
| `--dry-run` | `-n` | `false` | Preview changes without writing files |
| `--yes` | `-y` | `false` | Skip confirmation prompts (conflicts skipped unless `--overwrite`) |
| `--overwrite` | `-w` | `false` | Overwrite existing files at target |

## Supported Providers

`claude`, `opencode`, `codex`, `gemini`, `kiro`, `qoder`, `cursor`

## Behavior

1. Reads MCP config and skills from the source provider
2. Converts MCP config format to target provider format
3. Converts skills between structured and flat formats as needed
4. Builds a migration plan showing creates, conflicts, and skips
5. Writes files to target provider paths (unless `--dry-run`)

### MCP Format Conversion

MCP configs are automatically converted between provider-specific formats:

| Provider | MCP Config Format |
|----------|-------------------|
| Claude | JSON `{ mcpServers: { ... } }`, URL type: `"type": "http"` |
| OpenCode | JSON `{ mcp: { <name>: { type, command, environment } } }`, URL type: `"type": "remote"` |
| Codex | TOML `[mcp_servers]`, URL headers: `http_headers` |
| Gemini | JSON `{ mcpServers: { ... } }`, URL field: `httpUrl` |
| Kiro | JSON `{ mcpServers: { ... } }` |
| Qoder | JSON `{ mcpServers: { ... } }` |
| Cursor | JSON `{ mcpServers: { ... } }`, URL type: `"type": "sse"` |

### mcp-remote Bridge Detection

Stdio servers using `mcp-remote` as a bridge (e.g. `npx mcp-remote@latest https://...`) are automatically detected and converted to native URL transport. `--header` arguments are extracted and written as `headers` in the target config.

### Skills Format Conversion

- Structured → Flat: `<name>/SKILL.md` → `<name>.md` (references dropped)
- Flat → Structured: `<name>.md` → `<name>/SKILL.md`
- Same format: direct copy

### System Skills Filtering

Provider-internal directories (e.g. Codex `.system/`) are automatically excluded from migration.

### Conflict Handling

- Default: existing files at target are skipped
- `--overwrite`: force overwrite all conflicts
- Interactive mode: choose per file when conflicts are found

## Examples

```bash
# Migrate from Claude Code to Kiro (global scope)
usync migrate --from claude --to kiro

# Migrate from Codex to Claude Code
usync migrate --from codex --to claude

# Dry-run preview
usync migrate --from kiro --to claude --dry-run

# Skip prompts, skip conflicts
usync migrate --from claude --to kiro --yes

# Force overwrite existing files
usync migrate --from codex --to kiro --yes --overwrite

# Migrate project-level configs
usync migrate --from claude --to kiro --scope project
```
