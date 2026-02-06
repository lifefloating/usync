# usync（中文）

同步 ClaudeCode / OpenCode / Codex / Gemini CLI 的配置与 skills 到 GitHub Gist。

## 功能

- 同步多工具配置到同一个 Gist。
- 增量上传：只上传变化文件，不全量覆盖。
- 支持下载恢复到真实路径，或下载到指定测试目录。
- CLI 显示进度、上传列表、下载列表、跳过列表。
- 内置 `init`：验证 PAT 并校验/创建 Gist。
- 默认过滤明显敏感文件（`.env*`、`.pem`、`.key`、`.p12`）和系统噪音（`.DS_Store`）。
- 支持可选自动同步：`upload --watch` 轮询本地变化并增量上传。

## 自动发现路径

- **ClaudeCode**：`~/.claude/settings.json`、`~/.claude/settings.local.json`、`~/.claude/skills`，以及项目内 `.claude/*`
- **OpenCode**：`~/.config/opencode/opencode.json(.jsonc)`、`~/.config/opencode/skills`，以及项目内 `opencode.json(.jsonc)`、`.opencode/skills`
- **Codex**：`~/.codex/config.json`、`~/.codex/settings.json`、`~/.codex/skills`，以及项目内 `.codex/*`
- **Gemini CLI**：`~/.gemini/settings.json`、`~/.gemini/extensions`、`~/.gemini/skills`，以及项目内 `.gemini/*`

## 安装与构建

```bash
npm install
npm run build
```

## Token / Gist 准备

- 创建 PAT：https://github.com/settings/tokens/new
- 最低权限：`gist`
- 创建/查看 Gist：https://gist.github.com/

## 命令示例

```bash
# 1) 扫描本地可同步文件
npx usync scan

# 1.1) 验证 token 与 gist 访问
npx usync init --token <GITHUB_PAT> --gist-id <GIST_ID>

# 2) 上传到已有 gist
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID>

# 3) 创建新 gist 后上传
npx usync upload --token <GITHUB_PAT> --description cloudSettings --public

# 4) 下载并恢复到默认路径
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID>

# 5) 下载到测试目录
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID> --output-root /path/to/settingsTest

# 6) 本地有变化时自动上传
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID> --watch --interval 15
```

`scan` 不需要 PAT 和 Gist ID。
`upload/download/init` 需要 PAT，且 `upload/download` 还需要目标 Gist ID。

说明：若目标 gist 还没有 `usync` 的 manifest，`download` 会回退到原始 gist 文件下载到 `<output-root>/raw-gist/`。可加 `--strict-manifest` 禁止回退。

当使用 `--output-root` 时，会写成可见目录映射（不再使用点前缀隐藏目录），例如：
- `.../home/claude/...`
- `.../home/opencode/...`
- `.../home/gemini/...`
- `.../home/codex/...`
