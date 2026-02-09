# command: init

Validate GitHub token and Gist access, optionally create a new Gist.

## Usage

```bash
usync init [options]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--token` | string | — | GitHub Personal Access Token |
| `--token-env` | string | `GITHUB_TOKEN` | Environment variable name for token |
| `--gist-id` | string | — | Existing Gist ID to verify access |
| `--description` | string | `cloudSettings` | Description for new Gist |
| `--public` | boolean | `false` | Create public Gist |

## Interactive Mode

When run without flags in a TTY environment, `init` enters interactive mode:

1. **Token prompt** — If no token found via flags/env, prompts for password input
2. **Token verification** — Validates the token against GitHub API
3. **Gist selection** — Choose between existing Gist ID or creating a new one
4. **Confirmation** — Displays Gist ID and URL

In CI/non-TTY environments, all values must be provided via flags or env vars.

## Examples

```bash
# Interactive setup
usync init

# Verify existing Gist
usync init --gist-id abc123

# Create new private Gist with custom description
usync init --description "my-ai-configs"

# Create public Gist
usync init --public
```
