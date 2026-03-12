# usync

Sync Claude / OpenCode / Codex / Gemini / Kiro / Qoder / Cursor settings + skills to GitHub Gist.

## English

### Features

- Upload local config and skills files to a single Gist.
- Incremental update: only changed files are uploaded.
- Download and restore from Gist to real paths, or to a custom test directory.
- Progress output and detailed changed/uploaded/downloaded file lists.
- Built-in `init` command validates PAT and verifies/creates gist.
- Excludes obvious sensitive files by default (`.env*`, `.pem`, `.key`, `.p12`) and system noise (`.DS_Store`).
- Optional auto sync loop: `upload --watch` polls local changes and pushes incrementally.
- Cross-tool migration with format conversion, conflict handling, and `mcp-remote` bridge detection.
- TypeScript implementation, runnable via `npx` or `bunx` after build/publish.

### Supported sources (auto-discovery)

- **Claude**: `~/.claude.json` (global MCP), `~/.claude/settings.json`, `~/.claude/skills`, plus project `.mcp.json` and `.claude/*`
- **OpenCode**: `~/.config/opencode/opencode.json(.jsonc)`, `~/.config/opencode/skill`, plus project `opencode.json(.jsonc)` and `.opencode/skill`
- **Codex**: `~/.codex/config.toml`, `~/.codex/skills`, plus project `.codex/*`
- **Gemini**: `~/.gemini/settings.json`, `~/.gemini/extensions`, `~/.gemini/skills`, plus project `.gemini/*`
- **Kiro**: `~/.kiro/settings/mcp.json`, `~/.kiro/skills`, plus project `.kiro/settings/mcp.json` and `.kiro/steering`
- **Qoder**: `~/.qoder/mcp.json`, `~/.qoder/skills`, plus project `.qoder/mcp.json` and `.qoder/skills`
- **Cursor**: `~/.cursor/mcp.json`, `~/.cursor/rules`, plus project `.cursor/mcp.json` and `.cursor/rules`

### Install & build

```bash
npm install
npm run build
```

### Token setup

- Create PAT: https://github.com/settings/tokens/new
- Minimum scope: `gist`

### Gist setup

- Create/View gists: https://gist.github.com/

### Commands

```bash
# 1) Scan discovered files
npx usync-cli scan

# 1.1) Validate token and gist access
npx usync init --token <GITHUB_PAT> --gist-id <GIST_ID>
npx usync init -T <GITHUB_PAT> -g <GIST_ID>

# 2) Upload to existing gist
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID>
npx usync upload -T <GITHUB_PAT> -g <GIST_ID>

# 3) Create new gist and upload
npx usync upload --token <GITHUB_PAT> --description cloudSettings --public
npx usync upload -T <GITHUB_PAT> -d cloudSettings -p

# 4) Download and restore to real target paths
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID>
npx usync download -T <GITHUB_PAT> -g <GIST_ID>

# 5) Download to sandbox test directory
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID> --output-root /path/to/settingsTest
npx usync download -T <GITHUB_PAT> -g <GIST_ID> -o /path/to/settingsTest

# 6) Auto-upload when local files change
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID> --watch --interval 15
npx usync upload -T <GITHUB_PAT> -g <GIST_ID> --watch -i 15
```

`scan` does not require PAT or Gist ID.
`upload/download/init` require PAT, and `upload/download` need a target Gist ID.

#### scan options

| Option | Alias | Description |
|--------|-------|-------------|
| `--cwd` | `-C` | Project root directory |
| `--providers` | | Comma-separated provider filter |

#### init options

| Option | Alias | Description |
|--------|-------|-------------|
| `--token` | `-T` | GitHub PAT |
| `--gist-id` | `-g` | Existing gist ID to verify access |
| `--description` | `-d` | Description for new gist (default: `cloudSettings`) |
| `--public` | `-p` | Create public gist |

#### upload options

| Option | Alias | Description |
|--------|-------|-------------|
| `--token` | `-T` | GitHub PAT (scope: gist write) |
| `--gist-id` | `-g` | Existing gist ID |
| `--description` | `-d` | Gist description |
| `--public` | `-p` | Create public gist |
| `--cwd` | `-C` | Project root directory |
| `--interval` | `-i` | Watch interval in seconds (default: 15) |

#### download options

| Option | Alias | Description |
|--------|-------|-------------|
| `--gist-id` | `-g` | Gist ID (required) |
| `--token` | `-T` | GitHub PAT |
| `--cwd` | `-C` | Project root directory |
| `--output-root` | `-o` | Override restore destination (sandbox path) |

### Migrate

Migrate MCP configs and skills between AI coding tools.

```bash
# Migrate from Claude Code to Kiro (global scope, default)
npx usync migrate --from claude --to kiro
npx usync migrate -f claude -t kiro

# Migrate from Codex to Claude Code
npx usync migrate --from codex --to claude
npx usync migrate -f codex -t claude

# Dry-run: preview changes without writing
npx usync migrate --from kiro --to claude --dry-run
npx usync migrate -f kiro -t claude -n

# Skip confirmation prompts (conflicts are skipped by default)
npx usync migrate --from claude --to kiro --yes
npx usync migrate -f claude -t kiro -y

# Force overwrite existing files
npx usync migrate --from codex --to kiro --yes --overwrite
npx usync migrate -f codex -t kiro -y -w

# Migrate project-level configs
npx usync migrate --from claude --to kiro --scope project
npx usync migrate -f claude -t kiro -s project
```

Supported providers: `claude`, `opencode`, `codex`, `gemini`, `kiro`, `qoder`, `cursor`

Options:
| Option | Alias | Description |
|--------|-------|-------------|
| `--from` | `-f` | Source provider |
| `--to` | `-t` | Target provider |
| `--scope` | `-s` | `global` (default) or `project` |
| `--dry-run` | `-n` | Preview changes without writing files |
| `--yes` | `-y` | Skip confirmation prompts (conflicts are skipped unless `--overwrite` is set) |
| `--overwrite` | `-w` | Overwrite existing files at target (default: skip conflicts) |
| `--cwd` | `-C` | Project root directory (for project scope) |

#### Migration features

- **Format conversion**: MCP configs are automatically converted between provider formats (JSON `mcpServers`, OpenCode `mcp.<name>`, Codex TOML `[mcp_servers]`).
- **URL transport**: Remote MCP servers (HTTP/SSE) are serialized with provider-specific fields — `type: "http"` for Claude Code, `httpUrl` for Gemini, `type: "sse"` for Cursor, `type: "remote"` for OpenCode.
- **mcp-remote detection**: Stdio servers using `mcp-remote` as a bridge (e.g. `npx mcp-remote@latest https://...`) are automatically converted to native URL transport. `--header` arguments are extracted and written as `headers` in the target config.
- **Skills conversion**: Structured skills (`SKILL.md` + `references/`) are converted to flat format for providers that use flat files (Cursor, Gemini, Kiro project steering), and vice versa.
- **System skills filtering**: Provider-internal directories (e.g. Codex `.system/`) are excluded from migration.
- **Conflict handling**: Existing files at the target are skipped by default. Use `--overwrite` to force overwrite, or run interactively to choose per file.

Note: If the target gist has no `usync` manifest yet, `download` falls back to raw gist file download under `<output-root>/raw-gist/`. Add `--strict-manifest` to disable fallback.

When `--output-root` is used, files are written in a visible mapping layout (no hidden leading-dot directories), for example:
- `.../home/claude/...`
- `.../home/opencode/...`
- `.../home/gemini/...`
- `.../home/codex/...`

### PAT scope

- Use a token with Gist write permission (`gist`) for upload.
- Download can work without token for accessible gists, but token is recommended for private/secret access control.

---

## 中文文档

请查看：`README.zh-CN.md`
