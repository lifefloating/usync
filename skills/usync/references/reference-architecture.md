# Architecture Reference

## Template Paths

usync uses template paths to make file paths portable across machines:

| Token | Resolves to | Example |
|-------|-------------|---------|
| `$HOME` | User home directory | `$HOME/.claude/settings.json` |
| `$PROJECT` | Project root (`--cwd`) | `$PROJECT/.claude/skills/my-skill.md` |

Template paths always use POSIX separators (`/`) regardless of OS, ensuring cross-platform compatibility.

## Manifest Format

The sync manifest (`usync-manifest.v1.json`) is stored in the Gist alongside file data:

```json
{
  "version": 1,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-02T00:00:00.000Z",
  "generator": "usync-cli@0.1.0",
  "items": {
    "$HOME/.claude/settings.json": {
      "provider": "Claude",
      "category": "settings",
      "hash": "sha256-hex-string",
      "size": 1234,
      "gistFile": "usync-item-abc123.b64"
    }
  }
}
```

## File Storage

Each synced file is stored as a separate Gist file:

- Filename: `usync-item-{sha256(templatePath).slice(0,24)}.b64`
- Content: Base64-encoded file content
- This allows incremental updates → only changed files are patched

## Incremental Upload Flow

1. Fetch existing Gist (if `--gist-id` provided)
2. Parse manifest from Gist
3. Compare local file SHA-256 hashes against manifest
4. Build upload plan: `changed`, `unchanged`, `deleted`
5. Patch Gist with only changed/deleted files + updated manifest

## Cross-Platform Path Handling

usync uses `pathe` (unjs) for all path operations:

- All template paths use `/` separators
- `resolveTemplatePath()` converts templates back to OS-native paths
- OpenCode on Windows checks both `%APPDATA%/opencode/` and `~/.config/opencode/`
- Node.js `fs` APIs accept forward-slash paths on all platforms

## Migration Architecture

The `migrate` command converts MCP configs and skills between providers.

### Canonical MCP Format

All provider-specific MCP configs are parsed into a canonical internal format:

```ts
interface CanonicalMCPServer {
  name: string
  transport: 'stdio' | 'url'
  command?: string // stdio only
  args?: string[] // stdio only
  url?: string // url only
  headers?: Record<string, string> // url only
  env?: Record<string, string>
}
```

### Provider MCP Formats

| Provider | Config Format | URL Transport Field |
|----------|---------------|---------------------|
| Claude | JSON `mcpServers` | `type: "http"`, `url` |
| OpenCode | JSON `mcp.<name>` with `type: "local"/"remote"` | `type: "remote"`, `url` |
| Codex | TOML `[mcp_servers]` | `url`, headers via `http_headers` |
| Gemini | JSON `mcpServers` | `httpUrl` |
| Kiro | JSON `mcpServers` | `url` |
| Qoder | JSON `mcpServers` | `url` |
| Cursor | JSON `mcpServers` | `type: "sse"`, `url` |

### mcp-remote Bridge Detection

Stdio servers using `mcp-remote` as a bridge are automatically detected and converted to native URL transport. The detection pattern matches commands like `npx mcp-remote@latest https://...` and extracts `--header` arguments into the `headers` field.

### Skills Format

Providers use either structured or flat skills:

- Structured: `<name>/SKILL.md` + optional `references/` subdirectory
- Flat: `*.md` files directly in the skills directory

| Provider | Global | Project |
|----------|--------|---------|
| Claude | Structured | Structured |
| OpenCode | Structured | Structured |
| Codex | Structured | Structured |
| Gemini | Structured | Structured |
| Kiro | Structured | Flat (steering) |
| Qoder | Structured | Structured |
| Cursor | Structured | Structured |

Migration automatically converts between formats:
- Structured → Flat: `<name>/SKILL.md` becomes `<name>.md`
- Flat → Structured: `<name>.md` becomes `<name>/SKILL.md`

### Migration Flow

1. Read source MCP config and skills files
2. Filter out system skills (e.g. Codex `.system/`)
3. Convert skills format if source and target differ
4. Filter incompatible servers (e.g. URL servers with headers when target doesn't support them)
5. Build migration plan (create/conflict/skip per file)
6. Execute plan: write converted configs and skills to target paths
