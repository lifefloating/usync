# usync-cli: Refactor Design

## Goal

Refactor usync-cli to follow open-source CLI patterns: modern unjs ecosystem tooling, interactive prompts, cleaner code architecture, and standardized engineering practices.

## Constraints

- **Keep tsdown** as the build tool (no migration to unbuild)
- **Keep vitest** as the test framework
- Maintain all existing functionality (init, scan, upload, download)
- CI/non-TTY environments must still work via flags

---

## 1. Dependency Changes

### Remove

| Package     | Reason                          |
| ----------- | ------------------------------- |
| `commander` | Replace with citty              |
| `chalk`     | Replace with consola/colorette  |
| `tsx`        | Dev mode now uses tsdown --watch |

### Add (dependencies)

| Package           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `citty`           | unjs CLI framework, subcommands, auto-help, type-safe args |
| `consola`         | unjs logger, log levels, fancy/basic mode            |
| `colorette`       | Zero-dep terminal colors, unjs ecosystem standard    |
| `@clack/prompts`  | Interactive prompts (spinner, select, confirm, password) |

### Add (devDependencies)

| Package                | Purpose                    |
| ---------------------- | -------------------------- |
| `@antfu/eslint-config` | antfu's ESLint flat config |
| `eslint`               | ESLint core                |

---

## 2. Directory Structure

```
src/
├── cli.ts                  # Entry: defineCommand + subCommands (citty)
├── commands/               # Each subcommand in its own file
│   ├── init.ts
│   ├── scan.ts
│   ├── upload.ts
│   └── download.ts
├── utils/                  # Pure logic, no I/O formatting
│   ├── discovery.ts        # File discovery (from src/discovery.ts)
│   ├── fs.ts               # File operations (from src/file-utils.ts)
│   ├── gist.ts             # Gist API client (from src/gist-client.ts)
│   ├── path.ts             # Path template (from src/path-template.ts)
│   ├── sync.ts             # Sync logic (from src/sync.ts)
│   └── token.ts            # Token resolution (extracted from cli.ts)
├── providers.ts            # Provider definitions (unchanged)
└── types.ts                # Type definitions (unchanged)
```

**Principle:** `commands/` handles interaction + orchestration, `utils/` handles pure logic. `commands/` depends on `utils/`, `utils/` modules are independent of each other.

**Removed files:**
- `src/ui.ts` — replaced by consola
- `src/progress.ts` — replaced by @clack/prompts spinner

---

## 3. CLI Architecture (citty)

### Entry `src/cli.ts`

```ts
import { defineCommand, runMain } from 'citty'

const main = defineCommand({
  meta: {
    name: 'usync',
    version: '0.1.0',
    description: 'Sync AI CLI configs and skills to GitHub Gist',
  },
  subCommands: {
    init: () => import('./commands/init').then(m => m.default),
    scan: () => import('./commands/scan').then(m => m.default),
    upload: () => import('./commands/upload').then(m => m.default),
    download: () => import('./commands/download').then(m => m.default),
  },
})

runMain(main)
```

### Subcommand pattern `src/commands/upload.ts`

```ts
import { defineCommand } from 'citty'

export default defineCommand({
  meta: { description: 'Upload configs to GitHub Gist' },
  args: {
    token: { type: 'string', description: 'GitHub PAT' },
    tokenEnv: { type: 'string', default: 'GITHUB_TOKEN' },
    gistId: { type: 'string', required: true, description: 'Target Gist ID' },
    providers: { type: 'string', description: 'Filter providers (comma-separated)' },
    cwd: { type: 'string', description: 'Project root directory' },
    watch: { type: 'boolean', default: false, description: 'Watch mode' },
    interval: { type: 'string', default: '30', description: 'Watch interval (seconds)' },
  },
  run({ args }) {
    // Interaction + orchestration logic
  },
})
```

**Key traits:**
- Lazy-loaded subcommands via `() => import(...)` for fast startup
- citty auto-generates `--help` and `--version`
- No manual `parseAsync(process.argv)`

---

## 4. Interactive Experience (@clack/prompts)

### `usync init` — Full interactive flow (when no flags provided)

```
┌  usync — init
│
◆  Enter your GitHub Personal Access Token:
│  ghp_xxxx...
│
◇  Token verified! Hello, username
│
◆  Do you have an existing Gist ID?
│  ○ Yes, enter Gist ID
│  ● No, create a new one
│
◇  Created new Gist: abc123def
│
◆  Which providers do you want to sync?
│  ◻ ClaudeCode
│  ◻ OpenCode
│  ◻ Codex
│  ◻ Gemini CLI
│
└  Init complete! Run `usync upload` to start syncing.
```

### Logic

- If a flag is provided, skip the corresponding prompt (CI-friendly)
- `--token` missing → `clack.password()` (hidden input)
- `--gist-id` missing → `clack.select()` (existing / create new)
- Providers → `clack.multiselect()`

### upload / download

- Pre-action `clack.confirm()` before upload/overwrite
- `clack.spinner()` for long operations (replaces custom progress reporter)

### scan

- Formatted output via `consola`
- Optional interactive provider filter

### CI / non-TTY

Detect `process.env.CI` or `!process.stdout.isTTY` → skip all prompts, rely on flags only. Error and exit if required params missing.

---

## 5. Terminal Output (consola + colorette)

### Replace `ui.ts` entirely

```ts
import { cyan, green } from 'colorette'
import { consola } from 'consola'

consola.info('Discovering files...')
consola.success('Upload complete')
consola.warn('No files found for provider')
consola.error('Failed to connect to GitHub API')

// Custom formatting with colorette
consola.log(`  ${cyan('claudecode')} — ${green('3 files')}`)
```

### Remove `progress.ts`

Replaced by `@clack/prompts` spinner.

---

## 6. Code Style (patterns)

### Functional + small composable functions

- Break large action handlers into small pure functions
- Each function does one thing, easy to test

### Error handling — early return

```ts
const token = resolveToken(args)
if (!token) {
  consola.error('GitHub token is required')
  process.exit(1)
}
```

### File naming

All kebab-case (already consistent).

---

## 7. Engineering

### `tsdown.config.ts` (standalone config)

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
})
```

### `eslint.config.js`

```js
import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  rules: {
    'no-console': 'off',
  },
})
```

### `package.json` scripts

```json
{
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest run",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check": "tsc --noEmit",
    "prepare": "npm run build"
  }
}
```

---

## 8. Implementation Order

1. Add new dependencies, remove old ones
2. Create `tsdown.config.ts`, `eslint.config.js`
3. Restructure directories (`commands/`, `utils/`)
4. Migrate CLI from commander to citty (`cli.ts` + `commands/*`)
5. Replace chalk with consola + colorette
6. Add @clack/prompts interactive flows to commands
7. Extract shared logic (`utils/token.ts`)
8. Remove `ui.ts`, `progress.ts`
9. Update `package.json` scripts
10. Run `eslint --fix` for code style alignment
11. Run tests, fix any breakages
12. Update README
