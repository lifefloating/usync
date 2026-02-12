---
"usync": major
---

Initial release of usync

- Support syncing settings and skills for ClaudeCode, OpenCode, Codex, and Gemini CLI to GitHub Gist
- Commands: `scan`, `init`, `upload`, `download`
- Incremental upload with manifest-based change detection
- Auto-sync watch mode via `upload --watch`
- Sandbox download with `--output-root` for safe testing
- Built-in sensitive file exclusion (`.env*`, `.pem`, `.key`, etc.)
