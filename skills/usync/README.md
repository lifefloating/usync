# usync Skills for Claude Code

Agent skills that help Claude Code understand and work with [usync](https://github.com/lifefloating/usync), the AI CLI config sync tool.

## Installation

```bash
npx skills add lifefloating/usync
```

This will add the usync skill to your Claude Code configuration.

## What's Included

The usync skill provides Claude Code with knowledge about:

- **Core Concepts** - What usync does, supported providers, sync workflow
- **Commands** - init, scan, upload, download with all options
- **Providers** - ClaudeCode, OpenCode, Codex, Gemini CLI config paths
- **Architecture** - Template paths, manifest format, incremental sync
- **Cross-platform** - macOS and Windows path handling

## Usage

Once installed, Claude Code will automatically use usync knowledge when:

- Syncing AI CLI configurations to GitHub Gist
- Setting up config backup for ClaudeCode, OpenCode, Codex, or Gemini CLI
- Working with multi-tool AI development environments
- Managing skills and settings across machines

### Example Prompts

```
Set up usync to back up my Claude Code settings to a Gist
```

```
Sync my AI CLI configs from my work machine to my personal machine
```

```
Watch for changes in my AI tool configs and auto-upload
```

```
Download my synced configs to a new machine
```

## License

MIT
