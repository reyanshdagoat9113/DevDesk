import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => os.tmpdir(),
  },
}))

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'legacy-devdesk-store.json',
)

let tempRoot = ''

afterEach(() => {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
  tempRoot = ''
})

function makeTempPaths(prefix: string) {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  return {
    dbPath: path.join(tempRoot, 'devdesk.db'),
    jsonPath: path.join(tempRoot, 'devdesk-store.json'),
  }
}

function tableColumns(database: Database.Database, table: string): string[] {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (row) => row.name,
  )
}

describe('store migrations', () => {
  it('imports an older devdesk-store.json into a fresh SQLite database', async () => {
    const { initializeDatabaseAt } = await import('./core')
    const { dbPath, jsonPath } = makeTempPaths('devdesk-json-migrate-')
    fs.copyFileSync(fixturePath, jsonPath)

    const database = await initializeDatabaseAt(dbPath, jsonPath)
    try {
      const project = database
        .prepare('SELECT id, name, is_pinned FROM projects WHERE id = ?')
        .get('legacy-project') as { id: string; name: string; is_pinned: number }
      assert.equal(project.name, 'Legacy Demo')
      assert.equal(project.is_pinned, 0)

      const command = database
        .prepare('SELECT id, name, variables, is_pinned FROM commands WHERE id = ?')
        .get('legacy-cmd') as { id: string; name: string; variables: string | null; is_pinned: number }
      assert.equal(command.name, 'Start demo')
      assert.equal(command.is_pinned, 0)
      assert.ok(tableColumns(database, 'commands').includes('variables'))

      const notes = database
        .prepare('SELECT setup_steps, todos, reminders FROM notes WHERE project_id = ?')
        .get('legacy-project') as { setup_steps: string; todos: string; reminders: string }
      // Legacy ports/urls only merge into setupSteps when setupSteps is empty.
      assert.equal(notes.setup_steps, 'npm install')
      assert.equal(notes.todos, 'ship it')
      assert.equal(notes.reminders, 'check ports')

      const prefs = database.prepare('SELECT COUNT(*) AS count FROM preferences').get() as { count: number }
      assert.ok(prefs.count >= 1)
    } finally {
      database.close()
    }
  })

  it('upgrades an older SQLite schema with missing columns while preserving rows', async () => {
    const { ensureSchemaCompatibility } = await import('./core')
    const { dbPath } = makeTempPaths('devdesk-schema-migrate-')

    const database = new Database(dbPath)
    try {
      database.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          icon TEXT NOT NULL,
          linked_container_names TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE commands (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          command TEXT NOT NULL,
          description TEXT,
          tags TEXT,
          project_id TEXT,
          working_directory TEXT
        );
        CREATE TABLE run_history (
          id TEXT PRIMARY KEY,
          command_id TEXT NOT NULL,
          project_id TEXT,
          status TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          output TEXT
        );
        INSERT INTO projects (id, path, name, type, icon, linked_container_names)
        VALUES ('p-old', 'C:/old', 'Old Project', 'node', 'box', '[]');
        INSERT INTO commands (id, name, command, description, tags, project_id, working_directory)
        VALUES ('c-old', 'Build', 'npm run build', null, '[]', 'p-old', '.');
        INSERT INTO run_history (id, command_id, project_id, status, start_time, end_time, output)
        VALUES ('r-old', 'c-old', 'p-old', 'success', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:01.000Z', 'done');
      `)

      assert.equal(tableColumns(database, 'commands').includes('variables'), false)
      assert.equal(tableColumns(database, 'projects').includes('is_pinned'), false)
      assert.equal(tableColumns(database, 'run_history').includes('resolved_command'), false)

      ensureSchemaCompatibility(database)

      assert.ok(tableColumns(database, 'commands').includes('variables'))
      assert.ok(tableColumns(database, 'commands').includes('is_pinned'))
      assert.ok(tableColumns(database, 'projects').includes('is_pinned'))
      assert.ok(tableColumns(database, 'projects').includes('pinned_at'))
      assert.ok(tableColumns(database, 'run_history').includes('resolved_command'))

      const project = database.prepare('SELECT name FROM projects WHERE id = ?').get('p-old') as { name: string }
      assert.equal(project.name, 'Old Project')
      const command = database.prepare('SELECT name FROM commands WHERE id = ?').get('c-old') as { name: string }
      assert.equal(command.name, 'Build')
      const run = database.prepare('SELECT status FROM run_history WHERE id = ?').get('r-old') as { status: string }
      assert.equal(run.status, 'success')
    } finally {
      database.close()
    }
  })
})
