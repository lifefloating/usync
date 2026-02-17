# usync

Sync ClaudeCode / OpenCode / Codex / Gemini CLI / Kiro / Qoder / Cursor settings + skills to GitHub Gist.

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

- **ClaudeCode**: `~/.claude.json` (global MCP), `~/.claude/settings.json`, `~/.claude/skills`, plus project `.mcp.json` and `.claude/*`
- **OpenCode**: `~/.config/opencode/opencode.json(.jsonc)`, `~/.config/opencode/skills`, plus project `opencode.json(.jsonc)` and `.opencode/skills`
- **Codex**: `~/.codex/config.toml`, `~/.codex/skills`, plus project `.codex/*`
- **Gemini CLI**: `~/.gemini/settings.json`, `~/.gemini/extensions`, `~/.gemini/skills`, plus project `.gemini/*`
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
npx usync scan

# 1.1) Validate token and gist access
npx usync init --token <GITHUB_PAT> --gist-id <GIST_ID>

# 2) Upload to existing gist
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID>

# 3) Create new gist and upload
npx usync upload --token <GITHUB_PAT> --description cloudSettings --public

# 4) Download and restore to real target paths
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID>

# 5) Download to sandbox test directory
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID> --output-root /path/to/settingsTest

# 6) Auto-upload when local files change
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID> --watch --interval 15
```

`scan` does not require PAT or Gist ID.
`upload/download/init` require PAT, and `upload/download` need a target Gist ID.

### Migrate

Migrate MCP configs and skills between AI coding tools.

```bash
# Migrate from Claude Code to Kiro (global scope, default)
npx usync migrate --from claudecode --to kiro

# Migrate from Codex to Claude Code
npx usync migrate --from codex --to claudecode

# Dry-run: preview changes without writing
npx usync migrate --from kiro --to claudecode --dry-run

# Skip confirmation prompts (conflicts are skipped by default)
npx usync migrate --from claudecode --to kiro --yes

# Force overwrite existing files
npx usync migrate --from codex --to kiro --yes --overwrite

# Migrate project-level configs
npx usync migrate --from claudecode --to kiro --scope project
```

Supported providers: `claudecode`, `opencode`, `codex`, `gemini-cli`, `kiro`, `qoder`, `cursor`

Options:
- `--from` — Source provider
- `--to` — Target provider
- `--scope` — `global` (default) or `project`
- `--dry-run` — Preview changes without writing files
- `--yes` — Skip confirmation prompts (conflicts are skipped unless `--overwrite` is set)
- `--overwrite` — Overwrite existing files at target (default: skip conflicts)
- `--cwd` — Project root directory (for project scope)

#### Migration features

- **Format conversion**: MCP configs are automatically converted between provider formats (JSON `mcpServers`, OpenCode `mcp.<name>`, Codex TOML `[mcp_servers]`).
- **URL transport**: Remote MCP servers (HTTP/SSE) are serialized with provider-specific fields — `type: "http"` for Claude Code, `httpUrl` for Gemini CLI, `type: "sse"` for Cursor, `type: "remote"` for OpenCode.
- **mcp-remote detection**: Stdio servers using `mcp-remote` as a bridge (e.g. `npx mcp-remote@latest https://...`) are automatically converted to native URL transport. `--header` arguments are extracted and written as `headers` in the target config.
- **Skills conversion**: Structured skills (`SKILL.md` + `references/`) are converted to flat format for providers that use flat files (Cursor, Gemini CLI, Kiro project steering), and vice versa.
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
