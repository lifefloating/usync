# command: scan

Scan and list all discovered local config files without requiring authentication.

## Usage

```bash
usync scan [options]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--providers` | string | — | Comma-separated filter: `claude,opencode,codex,gemini,kiro,qoder,cursor` |
| `--cwd` | string | `process.cwd()` | Project root for project-level config discovery |

## Output

Lists all discovered files grouped by provider and category:

```
Scan result: 7 files

  → [claude/settings] /home/user/.claude/settings.json
  → [claude/skills] /home/user/.claude/skills/my-skill/SKILL.md
  → [opencode/settings] /home/user/.config/opencode/opencode.json
  → [codex/settings] /home/user/.codex/config.toml
  → [gemini/settings] /home/user/.gemini/settings.json
  → [kiro/settings] /home/user/.kiro/settings/mcp.json
  → [cursor/settings] /home/user/.cursor/mcp.json
```

## Examples

```bash
# Scan all providers
usync scan

# Scan only Claude configs
usync scan --providers Claude

# Scan with custom project root
usync scan --cwd /path/to/project
```
