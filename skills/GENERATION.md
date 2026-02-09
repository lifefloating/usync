# Skills Generation Information

## Generation Details

**Generated from source at:**
- **Date**: 2026-02-09
- **Version**: 0.1.0

**Source:**
- Main source: `/src` folder
- Project README: `/README.md`

## Structure

```
skills/
├── GENERATION.md               # This file
└── usync/
    ├── README.md               # User-facing README
    ├── SKILL.md                # Main skill file with quick reference
    └── references/             # Detailed reference documentation
```

## File Naming Convention

- `command-*` - CLI command documentation
- `guide-*` - Getting started and usage guides
- `reference-*` - Provider and architecture reference

## Updating Skills

When usync source changes, update the relevant files:
1. Check `src/commands/` for command changes
2. Check `src/providers.ts` for provider changes
3. Update SKILL.md quick reference accordingly
