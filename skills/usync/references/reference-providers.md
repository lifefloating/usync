# Providers Reference

usync auto-discovers configuration files from 7 AI CLI tool providers.

## Claude

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.claude.json` | Global MCP config |
| Global | `~/.claude/settings.json` | Settings file |
| Global | `~/.claude/settings.local.json` | Local settings |
| Global | `~/.claude/skills/` | Skills directory |
| Global | `~/.claude/teams/` | Teams directory |
| Global | `~/.claude/tasks/` | Tasks directory |
| Project | `.mcp.json` | Project MCP config |
| Project | `.claude/settings.json` | Project settings |
| Project | `.claude/settings.local.json` | Project local settings |
| Project | `.claude/skills/` | Project skills |

## OpenCode

| Scope | Path (macOS/Linux) | Path (Windows) | Type |
|-------|---------------------|----------------|------|
| Global | `~/.config/opencode/opencode.json` | `%APPDATA%/opencode/opencode.json` | Config file |
| Global | `~/.config/opencode/opencode.jsonc` | `%APPDATA%/opencode/opencode.jsonc` | Config file |
| Global | `~/.config/opencode/skills/` | `%APPDATA%/opencode/skills/` | Skills directory |
| Project | `opencode.json` | `opencode.json` | Project config |
| Project | `opencode.jsonc` | `opencode.jsonc` | Project config |
| Project | `.opencode/skills/` | `.opencode/skills/` | Project skills |

On Windows, both `%APPDATA%/opencode/` and `~/.config/opencode/` are scanned.

## Codex

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.codex/config.toml` | Config file (TOML) |
| Global | `~/.codex/config.json` | Config file |
| Global | `~/.codex/settings.json` | Settings file |
| Global | `~/.codex/skills/` | Skills directory |
| Project | `.codex/config.toml` | Project config (TOML) |
| Project | `.codex/config.json` | Project config |
| Project | `.codex/settings.json` | Project settings |
| Project | `.codex/skills/` | Project skills |

## Gemini

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.gemini/settings.json` | Settings file |
| Global | `~/.gemini/extensions/` | Extensions directory |
| Global | `~/.gemini/skills/` | Skills directory |
| Project | `.gemini/settings.json` | Project settings |
| Project | `.gemini/extensions/` | Project extensions |
| Project | `.gemini/skills/` | Project skills |

## Kiro

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.kiro/settings/mcp.json` | MCP config |
| Global | `~/.kiro/skills/` | Skills directory |
| Project | `.kiro/settings/mcp.json` | Project MCP config |
| Project | `.kiro/steering/` | Project steering (flat skills) |

## Qoder

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.qoder/mcp.json` | MCP config |
| Global | `~/.qoder/skills/` | Skills directory |
| Project | `.qoder/mcp.json` | Project MCP config |
| Project | `.qoder/skills/` | Project skills |

## Cursor

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.cursor/mcp.json` | MCP config |
| Global | `~/.cursor/rules/` | Rules directory |
| Global | `~/.cursor/skills/` | Skills directory |
| Project | `.cursor/mcp.json` | Project MCP config |
| Project | `.cursor/rules/` | Project rules |
| Project | `.cursor/skills/` | Project skills |

## Excluded Files

The following files are always excluded from sync:

- `.DS_Store`, `Thumbs.db` → OS metadata
- `.env`, `.env.local`, `.env.production`, `.env.development`, `.env.test` → Environment secrets
- `*.key`, `*.pem`, `*.p12` → Cryptographic keys
