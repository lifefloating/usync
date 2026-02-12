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
  "generator": "usync@0.1.0",
  "items": {
    "$HOME/.claude/settings.json": {
      "provider": "claudecode",
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
- This allows incremental updates — only changed files are patched

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
