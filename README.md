# usync

Sync ClaudeCode / OpenCode / Codex / Gemini CLI settings + skills to GitHub Gist.

## English

### Features

- Upload local config and skills files to a single Gist.
- Incremental update: only changed files are uploaded.
- Download and restore from Gist to real paths, or to a custom test directory.
- Progress output and detailed changed/uploaded/downloaded file lists.
- Built-in `init` command validates PAT and verifies/creates gist.
- Excludes obvious sensitive files by default (`.env*`, `.pem`, `.key`, `.p12`) and system noise (`.DS_Store`).
- Optional auto sync loop: `upload --watch` polls local changes and pushes incrementally.
- TypeScript implementation, runnable via `npx` or `bunx` after build/publish.

### Supported sources (auto-discovery)

- **ClaudeCode**: `~/.claude/settings.json`, `~/.claude/settings.local.json`, `~/.claude/skills`, plus project `.claude/*`
- **OpenCode**: `~/.config/opencode/opencode.json(.jsonc)`, `~/.config/opencode/skills`, plus project `opencode.json(.jsonc)` and `.opencode/skills`
- **Codex**: `~/.codex/config.json`, `~/.codex/settings.json`, `~/.codex/skills`, plus project `.codex/*`
- **Gemini CLI**: `~/.gemini/settings.json`, `~/.gemini/extensions`, `~/.gemini/skills`, plus project `.gemini/*`

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
