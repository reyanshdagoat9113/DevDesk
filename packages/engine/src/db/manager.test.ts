import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SCHEMA_VERSION } from './schema.js'
import { DatabaseManager } from './manager.js'

describe('DatabaseManager schema version', () => {
  let tempDir = ''
  let dbPath = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-engine-schema-'))
    dbPath = path.join(tempDir, 'engine.sqlite')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('fails closed when the on-disk schema is newer than this engine', () => {
    const db = new DatabaseManager(dbPath)
    db.close()

    const sqlite = new Database(dbPath)
    sqlite.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION + 1)
    sqlite.close()

    expect(() => new DatabaseManager(dbPath)).toThrow(
      `Index was created by a newer DevDesk version (schema ${SCHEMA_VERSION + 1}; this app supports ${SCHEMA_VERSION}). Re-index this project after updating, or clear the engine index.`
    )
  })

  it('rejects a newer schema before applying current schema SQL', () => {
    const sqlite = new Database(dbPath)
    sqlite.exec(`
      CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
      INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION + 1});
      CREATE TABLE files (id INTEGER PRIMARY KEY, file_path TEXT NOT NULL UNIQUE);
    `)
    sqlite.close()

    expect(() => new DatabaseManager(dbPath)).toThrow(
      `Index was created by a newer DevDesk version (schema ${SCHEMA_VERSION + 1}; this app supports ${SCHEMA_VERSION}). Re-index this project after updating, or clear the engine index.`
    )
  })
})
