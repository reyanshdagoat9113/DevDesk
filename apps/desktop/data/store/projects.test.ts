import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./attachments', () => ({
  deleteAttachmentFile: vi.fn(),
}))

const SCHEMA = `
  CREATE TABLE projects (id TEXT PRIMARY KEY);
  CREATE TABLE commands (project_id TEXT);
  CREATE TABLE chains (project_id TEXT);
  CREATE TABLE triggers (project_id TEXT);
  CREATE TABLE run_history (project_id TEXT);
  CREATE TABLE notes (project_id TEXT);
  CREATE TABLE engine_indexes (project_id TEXT);
  CREATE TABLE engine_search_sessions (project_id TEXT);
  CREATE TABLE health_check_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL
  );
  CREATE TABLE health_check_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES health_check_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE bug_reports (id TEXT PRIMARY KEY, project_id TEXT);
  CREATE TABLE bug_attachments (
    file_path TEXT NOT NULL,
    bug_report_id TEXT NOT NULL
  );
`

let testDb: Database.Database

vi.mock('../store/core', () => ({
  ensureDbInitialized: vi.fn(async () => {
    /* in-memory DB already created in beforeEach */
  }),
  getDbOrThrow: () => testDb,
  queueWrite: (fn: () => unknown) => Promise.resolve().then(() => fn()),
  withSqlTiming: (_label: string, fn: () => unknown) => fn(),
}))

async function importProjects() {
  return import('../store/projects')
}

describe('project store', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.pragma('foreign_keys = ON')
    testDb.exec(SCHEMA)
  })

  it('removes health check runs and their items when a project is removed', async () => {
    const { removeProject } = await importProjects()
    testDb.prepare('INSERT INTO projects (id) VALUES (?)').run('project-1')
    testDb.prepare('INSERT INTO projects (id) VALUES (?)').run('project-2')
    testDb.prepare('INSERT INTO health_check_runs (id, project_id) VALUES (?, ?)').run('run-1', 'project-1')
    testDb.prepare('INSERT INTO health_check_runs (id, project_id) VALUES (?, ?)').run('run-2', 'project-2')
    testDb.prepare('INSERT INTO health_check_items (id, run_id) VALUES (?, ?)').run('item-1', 'run-1')
    testDb.prepare('INSERT INTO health_check_items (id, run_id) VALUES (?, ?)').run('item-2', 'run-2')

    await removeProject('project-1')

    expect(testDb.prepare('SELECT id FROM health_check_runs ORDER BY id').all()).toEqual([{ id: 'run-2' }])
    expect(testDb.prepare('SELECT id FROM health_check_items ORDER BY id').all()).toEqual([{ id: 'item-2' }])
  })
})
