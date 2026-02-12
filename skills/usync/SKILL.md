---
name: usync
description: Sync ClaudeCode/OpenCode/Codex/Gemini CLI settings and skills to GitHub Gist. Use when backing up, restoring, or syncing AI CLI tool configurations across machines.
---

# usync - AI CLI Config Sync

Sync configurations and skills from ClaudeCode, OpenCode, Codex, and Gemini CLI to GitHub Gist for backup and cross-machine sync.

## When to Use

- Backing up AI CLI tool settings and skills to the cloud
- Syncing configurations across multiple machines
- Restoring AI CLI configs on a new machine
- Auto-syncing config changes with watch mode
- Managing settings for multiple AI CLI tools in one place

## Quick Start

```bash
# Install
pnpm add -g usync-cli

# Initialize — verify token and create a Gist
usync-cli init

# Scan — list all discovered config files
usync-cli scan

# Upload — sync local configs to Gist
usync-cli upload --gist-id <id>

# Download — restore configs from Gist
usync-cli download --gist-id <id>

# Watch mode — auto-upload on changes
usync-cli upload --gist-id <id> --watch
```

## Supported Providers

| Provider | Global Config | Project Config |
|----------|---------------|----------------|
| ClaudeCode | `~/.claude/settings.json`, `~/.claude/skills/` | `.claude/settings.json`, `.claude/skills/` |
| OpenCode | `~/.config/opencode/` (macOS), `%APPDATA%/opencode/` (Windows) | `opencode.json`, `.opencode/skills/` |
| Codex | `~/.codex/config.json`, `~/.codex/skills/` | `.codex/config.json`, `.codex/skills/` |
| Gemini CLI | `~/.gemini/settings.json`, `~/.gemini/skills/` | `.gemini/settings.json`, `.gemini/skills/` |

## Commands

| Command | Description | Reference |
|---------|-------------|-----------|
| `usync-cli init` | Verify token, create or validate Gist | [command-init](references/command-init.md) |
| `usync-cli scan` | List discovered local config files | [command-scan](references/command-scan.md) |
| `usync-cli upload` | Upload configs to GitHub Gist | [command-upload](references/command-upload.md) |
| `usync-cli download` | Download and restore configs from Gist | [command-download](references/command-download.md) |

## References

| Topic | Description | Reference |
|-------|-------------|-----------|
| Getting Started | Setup, token creation, first sync | [guide-getting-started](references/guide-getting-started.md) |
| Providers | All supported providers and config paths | [reference-providers](references/reference-providers.md) |
| Architecture | Template paths, manifest, incremental sync | [reference-architecture](references/reference-architecture.md) |

## Token Setup

usync-cli requires a GitHub Personal Access Token with `gist` scope:

1. Go to https://github.com/settings/tokens/new
2. Select scope: **gist**
3. Generate and save the token

Token resolution order:
1. `--token <PAT>` flag
2. Environment variable (default: `GITHUB_TOKEN`, or custom via `--token-env`)
3. `GH_TOKEN` fallback

## Common Patterns

### First-time setup

```bash
# Set token in environment
export GITHUB_TOKEN=ghp_xxx

# Initialize and create a new Gist
usync-cli init

# Upload all configs
usync-cli upload --gist-id <id-from-init>
```

### Restore on new machine

```bash
export GITHUB_TOKEN=ghp_xxx
usync-cli download --gist-id <id>
```

### Watch mode for continuous sync

```bash
usync-cli upload --gist-id <id> --watch --interval 30
```

### Filter specific providers

```bash
usync-cli scan --providers claudecode,opencode
usync-cli upload --gist-id <id> --providers claudecode
```

## Security

- Sensitive files are auto-excluded: `.env*`, `.key`, `.pem`, `.p12`
- File contents are base64-encoded in the Gist
- Use private Gists (default) for security
- Tokens are never stored locally — use env vars

## Tech Stack

- **CLI Framework**: citty (unjs)
- **Interactive Prompts**: @clack/prompts
- **Logging**: consola + colorette
- **Build**: tsdown
- **Path Handling**: pathe (cross-platform)
- **Package Manager**: pnpm
- **Versioning**: changesets
