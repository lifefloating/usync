# Getting Started

## Prerequisites

- Node.js >= 20
- A GitHub account with a Personal Access Token (PAT)

## Install

```bash
# Global install
pnpm add -g usync

# Or use npx
npx usync
```

## Create a GitHub Token

1. Go to https://github.com/settings/tokens/new
2. Set a name (e.g., "usync")
3. Select scope: **gist**
4. Generate and copy the token

## Set Up Token

```bash
# Option 1: Environment variable (recommended)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Option 2: Pass directly (not recommended for scripts)
usync init --token ghp_xxxxxxxxxxxx
```

## First Sync

```bash
# 1. Initialize — creates a new Gist
usync init
# → Outputs Gist ID (save this!)

# 2. Scan — verify what files will be synced
usync scan

# 3. Upload — sync to Gist
usync upload --gist-id <id>
```

## Restore on New Machine

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
usync download --gist-id <id>
```

## Continuous Sync

```bash
usync upload --gist-id <id> --watch
```

## Provider Filtering

Only sync specific tools:

```bash
usync upload --gist-id <id> --providers claudecode,opencode
```
