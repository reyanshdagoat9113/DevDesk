import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('native module loading (Node runtime)', () => {
  it('loads better-sqlite3 and opens an in-memory database', () => {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    try {
      const row = db.prepare('select 1 as value').get() as { value: number }
      assert.equal(row.value, 1)
    } finally {
      db.close()
    }
  })

  it('resolves node-pty package and native binary path', () => {
    const packageJsonPath = require.resolve('node-pty/package.json')
    const packageRoot = path.dirname(packageJsonPath)
    assert.ok(fs.existsSync(packageJsonPath), 'node-pty package.json should exist')

    const prebuilds = path.join(packageRoot, 'prebuilds')
    const buildRelease = path.join(packageRoot, 'build', 'Release')
    const hasNativeTree =
      (fs.existsSync(prebuilds) && fs.readdirSync(prebuilds).length > 0) ||
      fs.existsSync(path.join(buildRelease, 'pty.node')) ||
      fs.existsSync(path.join(buildRelease, 'conpty.node'))

    assert.ok(
      hasNativeTree,
      `node-pty native artifacts missing under ${packageRoot} (rebuild with npm run rebuild:native:electron)`,
    )

    // Loading under Node may fail when the binary was rebuilt for Electron ABI.
    // Package presence is the Node-gate regression; Electron load is covered by package verify.
    try {
      require('node-pty')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      assert.match(
        message,
        /NODE_MODULE_VERSION|was compiled against a different Node\.js version|ERR_DLOPEN_FAILED/i,
        `unexpected node-pty load error: ${message}`,
      )
    }
  })
})
