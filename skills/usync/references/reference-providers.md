# Providers Reference

usync auto-discovers configuration files from 4 AI CLI tool providers.

## ClaudeCode

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.claude/settings.json` | Settings file |
| Global | `~/.claude/settings.local.json` | Local settings |
| Global | `~/.claude/skills/` | Skills directory |
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
| Global | `~/.codex/config.json` | Config file |
| Global | `~/.codex/settings.json` | Settings file |
| Global | `~/.codex/skills/` | Skills directory |
| Project | `.codex/config.json` | Project config |
| Project | `.codex/settings.json` | Project settings |
| Project | `.codex/skills/` | Project skills |

## Gemini CLI

| Scope | Path | Type |
|-------|------|------|
| Global | `~/.gemini/settings.json` | Settings file |
| Global | `~/.gemini/extensions/` | Extensions directory |
| Global | `~/.gemini/skills/` | Skills directory |
| Project | `.gemini/settings.json` | Project settings |
| Project | `.gemini/extensions/` | Project extensions |
| Project | `.gemini/skills/` | Project skills |

## Excluded Files

The following files are always excluded from sync:

- `.DS_Store`, `Thumbs.db` — OS metadata
- `.env`, `.env.local`, `.env.production`, `.env.development`, `.env.test` — Environment secrets
- `*.key`, `*.pem`, `*.p12` — Cryptographic keys
