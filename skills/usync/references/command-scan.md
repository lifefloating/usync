# command: scan

Scan and list all discovered local config files without requiring authentication.

## Usage

```bash
usync-cli scan [options]
```

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--providers` | | — | Comma-separated filter: `claude,opencode,codex,gemini,kiro,qoder,cursor` |
| `--cwd` | `-C` | `process.cwd()` | Project root for project-level config discovery |

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
usync-cli scan

# Scan only Claude configs
usync scan --providers Claude

# Scan with custom project root
usync-cli scan --cwd /path/to/project
```
