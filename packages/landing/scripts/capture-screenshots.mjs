#!/usr/bin/env node
/**
 * Launcher for the landing screenshot harness.
 *
 * Spawns Electron with a clean environment. `ELECTRON_RUN_AS_NODE` is set by the
 * native-rebuild scripts (see docs/native-modules.md) and, if it leaks into this
 * shell, makes `require('electron')` return a path string instead of the app module
 * so the harness dies with "Cannot read properties of undefined (reading 'app')".
 * Deleting it here means the script works regardless of shell state.
 *
 * Usage:
 *   npm run landing:shots
 *   npm run landing:shots -- engine containers
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, 'screenshots', 'capture.cjs')

const electronBinary = require('electron')
if (typeof electronBinary !== 'string') {
  console.error('[shots] could not resolve the Electron binary path')
  process.exit(1)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronBinary, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[shots] electron terminated with signal ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error('[shots] failed to launch electron:', error)
  process.exit(1)
})
