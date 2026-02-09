# command: scan

Scan and list all discovered local config files without requiring authentication.

## Usage

```bash
usync scan [options]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--providers` | string | — | Comma-separated filter: `claudecode,opencode,codex,gemini-cli` |
| `--cwd` | string | `process.cwd()` | Project root for project-level config discovery |

## Output

Lists all discovered files grouped by provider and category:

```
Scan result: 5 files

  • [claudecode/settings] /home/user/.claude/settings.json
  • [claudecode/skills] /home/user/.claude/skills/my-skill/SKILL.md
  • [opencode/settings] /home/user/.config/opencode/opencode.json
  • [codex/settings] /home/user/.codex/config.json
  • [gemini-cli/settings] /home/user/.gemini/settings.json
```

## Examples

```bash
# Scan all providers
usync scan

# Scan only ClaudeCode configs
usync scan --providers claudecode

# Scan with custom project root
usync scan --cwd /path/to/project
```
