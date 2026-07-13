import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseManager } from './db/index.js'
import { getStats } from './index.js'

describe('devdesk-engine core', () => {
  let tempDir = ''
  let dbPath = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-engine-test-'))
    dbPath = path.join(tempDir, 'engine.sqlite')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('stores file records and search data in SQLite', () => {
    const db = new DatabaseManager(dbPath)

    db.upsertFile({
      path: '/repo/src/app.ts',
      filename: 'app.ts',
      extension: 'ts',
      size_bytes: 64,
      mtime_ms: Date.now(),
      content_hash: 'app-hash',
      language: 'typescript',
      is_binary: false,
      content: 'export const needle = true\n',
    })

    const stored = db.getFileByPath('/repo/src/app.ts')
    const ranked = db.searchRanked('needle', { limit: 5 })

    expect(stored?.filename).toBe('app.ts')
    expect(ranked).toHaveLength(1)
    expect(ranked[0].path).toBe('/repo/src/app.ts')

    db.close()
  })

  it('returns normalized stats from an indexed database', () => {
    const db = new DatabaseManager(dbPath)

    db.upsertFiles([
      {
        path: '/repo/src/app.ts',
        filename: 'app.ts',
        extension: 'ts',
        size_bytes: 64,
        mtime_ms: Date.now(),
        content_hash: 'app-hash',
        language: 'typescript',
        is_binary: false,
        content: 'export const app = true\n',
      },
      {
        path: '/repo/src/lib.rs',
        filename: 'lib.rs',
        extension: 'rs',
        size_bytes: 32,
        mtime_ms: Date.now(),
        content_hash: 'lib-hash',
        language: 'rust',
        is_binary: false,
        content: 'pub fn lib() {}\n',
      },
    ])

    db.close()

    const stats = getStats(dbPath)
    expect(stats.ok).toBe(true)
    expect(stats.db).toBe(dbPath.replace(/\\/g, '/'))
    expect(stats.stats.totalFiles).toBe(2)
    expect(stats.stats.byLanguage.typescript).toBe(1)
    expect(stats.stats.byLanguage.rust).toBe(1)
  })
})
