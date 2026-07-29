import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, it, vi } from 'vitest'

let tempRoot = ''
let openDb: Database.Database | null = null

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => tempRoot || os.tmpdir(),
  },
}))

afterEach(async () => {
  const { __resetDbForTests } = await import('./core')
  try {
    openDb?.close()
  } catch {
    // ignore
  }
  openDb = null
  __resetDbForTests()
  if (tempRoot && fs.existsSync(tempRoot)) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      // Windows may briefly lock WAL files; not a test failure.
    }
  }
  tempRoot = ''
})

describe('importAllData atomic replace', () => {
  it('fails closed and keeps prior rows when replace insert errors', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-import-'))
    const dbPath = path.join(tempRoot, 'devdesk.db')
    const jsonPath = path.join(tempRoot, 'devdesk-store.json')

    const { initializeDatabaseAt, __setDbForTests, getDbOrThrow } = await import('./core')
    openDb = await initializeDatabaseAt(dbPath, jsonPath)
    openDb
      .prepare(
        `INSERT INTO projects (id, path, name, type, icon, linked_container_names, is_pinned)
         VALUES (?, ?, ?, ?, ?, '[]', 0)`,
      )
      .run('keep-me', path.join(tempRoot, 'proj'), 'Keep Me', 'node', 'box')
    __setDbForTests(openDb)

    const { importAllData, EXPORT_VERSION, TABLE_NAMES } = await import('./export')

    const tables: Record<string, unknown[][]> = {}
    for (const name of TABLE_NAMES) {
      tables[name] = []
    }
    tables.projects = [['only-id']]

    const result = await importAllData(
      {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        platform: process.platform,
        tables,
      },
      'replace',
    )

    assert.equal(result.success, false)
    assert.ok(result.backupPath)
    assert.ok(result.error)

    const remaining = getDbOrThrow()
      .prepare('SELECT id FROM projects WHERE id = ?')
      .get('keep-me') as { id: string } | undefined
    assert.equal(remaining?.id, 'keep-me')
  })

  it('rejects foreign-key violations in replace mode', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-import-fk-'))
    const dbPath = path.join(tempRoot, 'devdesk.db')
    const jsonPath = path.join(tempRoot, 'devdesk-store.json')

    const { initializeDatabaseAt, __setDbForTests, getDbOrThrow } = await import('./core')
    openDb = await initializeDatabaseAt(dbPath, jsonPath)
    __setDbForTests(openDb)

    const { importAllData, EXPORT_VERSION, TABLE_NAMES } = await import('./export')
    const tables: Record<string, unknown[][]> = {}
    for (const name of TABLE_NAMES) {
      tables[name] = []
    }

    // bug_reports has FK to projects — orphan project_id must fail closed
    const bugCols = (
      openDb.prepare(`PRAGMA table_info(bug_reports)`).all() as Array<{ name: string }>
    ).map((c) => c.name)
    const now = new Date().toISOString()
    const bugRow = bugCols.map((col) => {
      if (col === 'id') return 'bug-1'
      if (col === 'project_id') return 'missing-project'
      if (col === 'title') return 'orphan'
      if (col === 'severity') return 'medium'
      if (col === 'status') return 'open'
      if (col === 'created_at' || col === 'updated_at') return now
      return null
    })
    tables.bug_reports = [bugRow]

    const result = await importAllData(
      {
        version: EXPORT_VERSION,
        exportedAt: now,
        platform: process.platform,
        tables,
      },
      'replace',
    )

    assert.equal(result.success, false, result.error)
    assert.match(result.error ?? '', /foreign key|failed to import/i)
    const count = getDbOrThrow().prepare('SELECT COUNT(*) AS c FROM bug_reports').get() as { c: number }
    assert.equal(count.c, 0)
  })
})
