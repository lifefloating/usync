#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'

const main = defineCommand({
  meta: {
    name: 'usync',
    version: '0.1.0',
    description: 'Sync ClaudeCode/OpenCode/Codex/Gemini CLI configs and skills to GitHub Gist',
  },
  subCommands: {
    init: () => import('./commands/init.js').then(m => m.default),
    scan: () => import('./commands/scan.js').then(m => m.default),
    upload: () => import('./commands/upload.js').then(m => m.default),
    download: () => import('./commands/download.js').then(m => m.default),
  },
})

runMain(main)
