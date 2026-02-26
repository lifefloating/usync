# usync（中文）

同步 Claude / OpenCode / Codex / Gemini / Kiro / Qoder / Cursor 的配置与 skills 到 GitHub Gist。

## 功能

- 同步多工具配置到同一个 Gist。
- 增量上传：只上传变化文件，不全量覆盖。
- 支持下载恢复到真实路径，或下载到指定测试目录。
- CLI 显示进度、上传列表、下载列表、跳过列表。
- 内置 `init`：验证 PAT 并校验/创建 Gist。
- 默认过滤明显敏感文件（`.env*`、`.pem`、`.key`、`.p12`）和系统噪音（`.DS_Store`）。
- 支持可选自动同步：`upload --watch` 轮询本地变化并增量上传。
- 跨工具迁移：自动格式转换、冲突处理、`mcp-remote` 桥接检测。

## 自动发现路径

- **Claude**：`~/.claude.json`（全局 MCP）、`~/.claude/settings.json`、`~/.claude/skills`，以及项目内 `.mcp.json`、`.claude/*`
- **OpenCode**：`~/.config/opencode/opencode.json(.jsonc)`、`~/.config/opencode/skill`，以及项目内 `opencode.json(.jsonc)`、`.opencode/skill`
- **Codex**：`~/.codex/config.toml`、`~/.codex/skills`，以及项目内 `.codex/*`
- **Gemini**：`~/.gemini/settings.json`、`~/.gemini/extensions`、`~/.gemini/skills`，以及项目内 `.gemini/*`
- **Kiro**：`~/.kiro/settings/mcp.json`、`~/.kiro/skills`，以及项目内 `.kiro/settings/mcp.json`、`.kiro/steering`
- **Qoder**：`~/.qoder/mcp.json`、`~/.qoder/skills`，以及项目内 `.qoder/mcp.json`、`.qoder/skills`
- **Cursor**：`~/.cursor/mcp.json`、`~/.cursor/rules`，以及项目内 `.cursor/mcp.json`、`.cursor/rules`

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
npx usync init -T <GITHUB_PAT> -g <GIST_ID>

# 2) 上传到已有 gist
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID>
npx usync upload -T <GITHUB_PAT> -g <GIST_ID>

# 3) 创建新 gist 后上传
npx usync upload --token <GITHUB_PAT> --description cloudSettings --public
npx usync upload -T <GITHUB_PAT> -d cloudSettings -p

# 4) 下载并恢复到默认路径
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID>
npx usync download -T <GITHUB_PAT> -g <GIST_ID>

# 5) 下载到测试目录
npx usync download --token <GITHUB_PAT> --gist-id <GIST_ID> --output-root /path/to/settingsTest
npx usync download -T <GITHUB_PAT> -g <GIST_ID> -o /path/to/settingsTest

# 6) 本地有变化时自动上传
npx usync upload --token <GITHUB_PAT> --gist-id <GIST_ID> --watch --interval 15
npx usync upload -T <GITHUB_PAT> -g <GIST_ID> --watch -i 15
```

`scan` 不需要 PAT 和 Gist ID。
`upload/download/init` 需要 PAT，且 `upload/download` 还需要目标 Gist ID。

#### scan 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--cwd` | `-C` | 项目根目录 |
| `--providers` | | 逗号分隔的工具过滤 |

#### init 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--token` | `-T` | GitHub PAT |
| `--gist-id` | `-g` | 已有 Gist ID（验证访问权限） |
| `--description` | `-d` | 新 Gist 描述（默认：`cloudSettings`） |
| `--public` | `-p` | 创建公开 Gist |

#### upload 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--token` | `-T` | GitHub PAT（需要 gist 写权限） |
| `--gist-id` | `-g` | 已有 Gist ID |
| `--description` | `-d` | Gist 描述 |
| `--public` | `-p` | 创建公开 Gist |
| `--cwd` | `-C` | 项目根目录 |
| `--interval` | `-i` | 轮询间隔秒数（默认：15） |

#### download 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--gist-id` | `-g` | Gist ID（必填） |
| `--token` | `-T` | GitHub PAT |
| `--cwd` | `-C` | 项目根目录 |
| `--output-root` | `-o` | 自定义恢复目标路径 |

### 迁移（Migrate）

在 AI 编码工具之间迁移 MCP 配置和 skills。

```bash
# 从 Claude Code 迁移到 Kiro（默认全局范围）
npx usync migrate --from claude --to kiro
npx usync migrate -f claude -t kiro

# 从 Codex 迁移到 Claude Code
npx usync migrate --from codex --to claude
npx usync migrate -f codex -t claude

# 预览模式：只显示变更，不写入文件
npx usync migrate --from kiro --to claude --dry-run
npx usync migrate -f kiro -t claude -n

# 跳过确认提示（冲突默认跳过）
npx usync migrate --from claude --to kiro --yes
npx usync migrate -f claude -t kiro -y

# 强制覆盖已有文件
npx usync migrate --from codex --to kiro --yes --overwrite
npx usync migrate -f codex -t kiro -y -w

# 迁移项目级配置
npx usync migrate --from claude --to kiro --scope project
npx usync migrate -f claude -t kiro -s project
```

支持的工具：`claude`、`opencode`、`codex`、`gemini`、`kiro`、`qoder`、`cursor`

参数：
| 参数 | 缩写 | 说明 |
|------|------|------|
| `--from` | `-f` | 源工具 |
| `--to` | `-t` | 目标工具 |
| `--scope` | `-s` | `global`（默认）或 `project` |
| `--dry-run` | `-n` | 预览变更，不写入文件 |
| `--yes` | `-y` | 跳过确认提示（冲突默认跳过，除非同时指定 `--overwrite`） |
| `--overwrite` | `-w` | 强制覆盖目标已有文件（默认跳过冲突） |
| `--cwd` | `-C` | 项目根目录（用于 project 范围） |

#### 迁移特性

- **格式自动转换**：MCP 配置在不同工具格式间自动转换（JSON `mcpServers`、OpenCode `mcp.<name>`、Codex TOML `[mcp_servers]`）。
- **URL transport**：远程 MCP 服务器（HTTP/SSE）按目标工具格式序列化 — Claude Code 用 `type: "http"`，Gemini 用 `httpUrl`，Cursor 用 `type: "sse"`，OpenCode 用 `type: "remote"`。
- **mcp-remote 检测**：使用 `mcp-remote` 做桥接的 stdio 服务器（如 `npx mcp-remote@latest https://...`）会自动转换为原生 URL transport。`--header` 参数会被提取并写入目标配置的 `headers` 字段。
- **Skills 格式转换**：结构化 skills（`SKILL.md` + `references/`）会自动转换为扁平格式（适用于 Cursor、Gemini、Kiro 项目 steering），反之亦然。
- **系统 skills 过滤**：工具内部目录（如 Codex `.system/`）在迁移时自动排除。
- **冲突处理**：目标已有文件默认跳过。使用 `--overwrite` 强制覆盖，或交互模式下逐个选择。

说明：若目标 gist 还没有 `usync` 的 manifest，`download` 会回退到原始 gist 文件下载到 `<output-root>/raw-gist/`。可加 `--strict-manifest` 禁止回退。

当使用 `--output-root` 时，会写成可见目录映射（不再使用点前缀隐藏目录），例如：
- `.../home/claude/...`
- `.../home/opencode/...`
- `.../home/gemini/...`
- `.../home/codex/...`
