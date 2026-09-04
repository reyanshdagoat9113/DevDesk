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
  it('exports v2 tables with column headers and imports a row across a mid-schema insertion', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-export-schema-v2-'))
    const dbPath = path.join(tempRoot, 'devdesk.db')
    const jsonPath = path.join(tempRoot, 'devdesk-store.json')

    const { initializeDatabaseAt, __setDbForTests, getDbOrThrow } = await import('./core')
    openDb = await initializeDatabaseAt(dbPath, jsonPath)
    __setDbForTests(openDb)

    const { exportAllData, importAllData, EXPORT_FORMAT_VERSION, EXPORT_VERSION, TABLE_NAMES } = await import('./export')
    const exported = await exportAllData()
    assert.equal(exported.success, true)
    if (!exported.success) throw new Error(exported.error)
    assert.equal(exported.data.formatVersion, EXPORT_FORMAT_VERSION)
    assert.deepEqual(exported.data.tables.projects.columns, (
      openDb.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
    ).map((column) => column.name))

    const tables = Object.fromEntries(TABLE_NAMES.map((name) => [name, { columns: [], rows: [] }])) as Record<
      string,
      { columns: string[]; rows: unknown[][] }
    >
    // `description` and `tags` emulate columns inserted into the current
    // schema after this backup was created. Headers preserve each value's
    // identity instead of shifting it into those new positions.
    tables.commands = {
      columns: ['id', 'name', 'command', 'project_id', 'working_directory', 'variables', 'is_pinned', 'pinned_at'],
      rows: [[
        'schema-safe-command',
        'Schema-safe command',
        'npm test',
        null,
        tempRoot,
        '{"token":"value"}',
        1,
        null,
      ]],
    }

    const result = await importAllData({
      formatVersion: EXPORT_FORMAT_VERSION,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      platform: process.platform,
      tables,
    }, 'replace')

    assert.equal(result.success, true, result.error)
    const command = getDbOrThrow().prepare(
      'SELECT name, command, description, tags, working_directory, variables, is_pinned FROM commands WHERE id = ?',
    ).get('schema-safe-command') as Record<string, unknown>
    assert.deepEqual(command, {
      name: 'Schema-safe command',
      command: 'npm test',
      description: null,
      tags: null,
      working_directory: tempRoot,
      variables: '{"token":"value"}',
      is_pinned: 1,
    })
  })

  it('continues to import a positional v1 backup', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-export-schema-v1-'))
    const dbPath = path.join(tempRoot, 'devdesk.db')
    const jsonPath = path.join(tempRoot, 'devdesk-store.json')

    const { initializeDatabaseAt, __setDbForTests, getDbOrThrow } = await import('./core')
    openDb = await initializeDatabaseAt(dbPath, jsonPath)
    __setDbForTests(openDb)

    const { importAllData, TABLE_NAMES } = await import('./export')
    const tables: Record<string, unknown[][]> = Object.fromEntries(TABLE_NAMES.map((name) => [name, []]))
    tables.projects = [['legacy-project', path.join(tempRoot, 'legacy'), 'Legacy Project', 'node', 'box', '[]', 0, null]]

    const result = await importAllData({
      version: 1,
      exportedAt: new Date().toISOString(),
      platform: process.platform,
      tables,
    }, 'replace')

    assert.equal(result.success, true, result.error)
    const project = getDbOrThrow().prepare('SELECT name, path FROM projects WHERE id = ?').get('legacy-project') as Record<string, unknown>
    assert.deepEqual(project, { name: 'Legacy Project', path: path.join(tempRoot, 'legacy') })
  })

  it('rejects v2 rows whose length does not match their stored headers', async () => {
    const { EXPORT_FORMAT_VERSION, EXPORT_VERSION, TABLE_NAMES, validateExportData } = await import('./export')
    const tables = Object.fromEntries(TABLE_NAMES.map((name) => [name, { columns: [], rows: [] }])) as Record<
      string,
      { columns: string[]; rows: unknown[][] }
    >
    tables.projects = { columns: ['id', 'path'], rows: [['only-id']] }

    const validation = validateExportData({
      formatVersion: EXPORT_FORMAT_VERSION,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      platform: process.platform,
      tables,
    })

    assert.equal(validation.valid, false)
    assert.match(validation.error ?? '', /does not match its 2 column header/i)
  })

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
