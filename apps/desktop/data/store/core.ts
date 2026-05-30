import fs from 'node:fs/promises'
import path from 'node:path'

import Database from 'better-sqlite3'

import type { DataStore } from '../model'
import { createDefaultStore, getDbPath, getStorePath, SQL_DEBUG, SQL_SLOW_MS } from './shared'
import { normalizeStore } from './normalize'

let initPromise: Promise<void> | null = null
let db: Database.Database | null = null
let writeQueue = Promise.resolve()

async function ensureStoreDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function backupCorruptStore(filePath: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${filePath}.corrupt-${timestamp}`
  try {
    await fs.rename(filePath, backupPath)
  } catch {
    // Best effort backup; ignore if it fails.
  }
}

export function getDbOrThrow(): Database.Database {
  if (!db) {
    throw new Error('Database is not initialized yet.')
  }
  return db
}

function createSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT NOT NULL,
      linked_container_names TEXT NOT NULL DEFAULT '[]',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      project_id TEXT,
      working_directory TEXT,
      variables TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS chains (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project_id TEXT,
      steps TEXT NOT NULL,
      stop_on_failure INTEGER NOT NULL DEFAULT 1,
      parallel INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS triggers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project_id TEXT,
      chain_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      require_confirmation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_history (
      id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL,
      project_id TEXT,
      status TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      output TEXT,
      resolved_command TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      project_id TEXT PRIMARY KEY,
      setup_steps TEXT NOT NULL DEFAULT '',
      todos TEXT NOT NULL DEFAULT '',
      reminders TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      id TEXT NOT NULL,
      command TEXT
    );

    CREATE TABLE IF NOT EXISTS engine_indexes (
      project_id TEXT PRIMARY KEY,
      db_path TEXT NOT NULL,
      last_indexed TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS engine_search_sessions (
      project_id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      regex INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      result_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_check_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      overall_status TEXT NOT NULL,
      summary_json TEXT
    );

    CREATE TABLE IF NOT EXISTS health_check_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      details_json TEXT,
      suggested_fix TEXT,
      FOREIGN KEY (run_id) REFERENCES health_check_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      expected_result TEXT,
      actual_result TEXT,
      reproduction_steps TEXT,
      notes TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bug_context_snapshots (
      id TEXT PRIMARY KEY,
      bug_report_id TEXT NOT NULL,
      command_history_json TEXT,
      run_history_json TEXT,
      logs_json TEXT,
      environment_snapshot_json TEXT,
      active_container_state_json TEXT,
      health_snapshot_json TEXT,
      notes_snippet_json TEXT,
      FOREIGN KEY (bug_report_id) REFERENCES bug_reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_commands_project_id ON commands(project_id);
    CREATE INDEX IF NOT EXISTS idx_chains_project_id ON chains(project_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_project_id ON triggers(project_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_chain_id ON triggers(chain_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_event_type ON triggers(event_type);
    CREATE INDEX IF NOT EXISTS idx_run_history_start_time ON run_history(start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_run_history_command_id ON run_history(command_id);
    CREATE INDEX IF NOT EXISTS idx_run_history_project_id ON run_history(project_id);
    CREATE INDEX IF NOT EXISTS idx_engine_indexes_last_indexed ON engine_indexes(last_indexed DESC);
    CREATE INDEX IF NOT EXISTS idx_engine_search_sessions_updated_at ON engine_search_sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_check_items_run_id ON health_check_items(run_id);
    CREATE INDEX IF NOT EXISTS idx_health_check_runs_project_id ON health_check_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_health_check_runs_started_at ON health_check_runs(started_at DESC);
    CREATE TABLE IF NOT EXISTS bug_attachments (
      id TEXT PRIMARY KEY,
      bug_report_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'file',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (bug_report_id) REFERENCES bug_reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bug_reports_project_id ON bug_reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
    CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
    CREATE INDEX IF NOT EXISTS idx_bug_reports_updated_at ON bug_reports(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bug_context_snapshots_bug_report_id ON bug_context_snapshots(bug_report_id);
    CREATE INDEX IF NOT EXISTS idx_bug_attachments_bug_report_id ON bug_attachments(bug_report_id);
  `)
}

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === columnName)
}

function ensureSchemaCompatibility(database: Database.Database) {
  if (!hasColumn(database, 'commands', 'variables')) {
    database.exec('ALTER TABLE commands ADD COLUMN variables TEXT')
  }

  if (!hasColumn(database, 'run_history', 'resolved_command')) {
    database.exec('ALTER TABLE run_history ADD COLUMN resolved_command TEXT')
  }

  if (!hasColumn(database, 'projects', 'is_pinned')) {
    database.exec('ALTER TABLE projects ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0')
  }

  if (!hasColumn(database, 'projects', 'pinned_at')) {
    database.exec('ALTER TABLE projects ADD COLUMN pinned_at TEXT')
  }

  if (!hasColumn(database, 'commands', 'is_pinned')) {
    database.exec('ALTER TABLE commands ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0')
  }

  if (!hasColumn(database, 'commands', 'pinned_at')) {
    database.exec('ALTER TABLE commands ADD COLUMN pinned_at TEXT')
  }
}

export function queueWrite<T>(writer: () => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(() => writer())
  writeQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export async function withSqlTiming<T>(label: string, operation: () => T | Promise<T>): Promise<T> {
  const startedAt = Date.now()
  const result = await operation()
  if (SQL_DEBUG) {
    const elapsed = Date.now() - startedAt
    if (elapsed >= SQL_SLOW_MS) {
      console.info(`[store][sql][slow] ${label} ${elapsed}ms`)
    } else {
      console.info(`[store][sql] ${label} ${elapsed}ms`)
    }
  }
  return result
}

function writeStoreToDb(database: Database.Database, store: DataStore) {
  const insertProject = database.prepare(`
    INSERT INTO projects (id, path, name, type, icon, linked_container_names, is_pinned, pinned_at)
    VALUES (@id, @path, @name, @type, @icon, @linkedContainerNames, @isPinned, @pinnedAt)
  `)
  const insertCommand = database.prepare(`
    INSERT INTO commands (id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at)
    VALUES (@id, @name, @command, @description, @tags, @projectId, @workingDirectory, @variables, @isPinned, @pinnedAt)
  `)
  const insertRunHistory = database.prepare(`
    INSERT INTO run_history (id, command_id, project_id, status, start_time, end_time, output, resolved_command)
    VALUES (@id, @commandId, @projectId, @status, @startTime, @endTime, @output, @resolvedCommand)
  `)
  const insertChain = database.prepare(`
    INSERT INTO chains (id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at)
    VALUES (@id, @name, @description, @projectId, @steps, @stopOnFailure, @parallel, @createdAt, @updatedAt)
  `)
  const insertTrigger = database.prepare(`
    INSERT INTO triggers (id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at)
    VALUES (@id, @name, @description, @projectId, @chainId, @eventType, @enabled, @requireConfirmation, @createdAt, @updatedAt)
  `)
  const insertNote = database.prepare(`
    INSERT INTO notes (project_id, setup_steps, todos, reminders)
    VALUES (@projectId, @setupSteps, @todos, @reminders)
  `)
  const insertPreference = database.prepare(`
    INSERT INTO preferences (key, id, command)
    VALUES (@key, @id, @command)
  `)
  const insertEngineIndex = database.prepare(`
    INSERT INTO engine_indexes (project_id, db_path, last_indexed, file_count)
    VALUES (@projectId, @dbPath, @lastIndexed, @fileCount)
  `)
  const insertEngineSearchSession = database.prepare(`
    INSERT INTO engine_search_sessions (project_id, query, regex, updated_at, result_json)
    VALUES (@projectId, @query, @regex, @updatedAt, @resultJson)
  `)
  const insertBugReport = database.prepare(`
    INSERT INTO bug_reports (
      id,
      project_id,
      title,
      severity,
      status,
      expected_result,
      actual_result,
      reproduction_steps,
      notes,
      resolution_notes,
      created_at,
      updated_at,
      resolved_at
    )
    VALUES (
      @id,
      @projectId,
      @title,
      @severity,
      @status,
      @expectedResult,
      @actualResult,
      @reproductionSteps,
      @notes,
      @resolutionNotes,
      @createdAt,
      @updatedAt,
      @resolvedAt
    )
  `)

  const writeTransaction = database.transaction((payload: DataStore) => {
    database.prepare('DELETE FROM bug_reports').run()
    database.prepare('DELETE FROM projects').run()
    database.prepare('DELETE FROM commands').run()
    database.prepare('DELETE FROM chains').run()
    database.prepare('DELETE FROM triggers').run()
    database.prepare('DELETE FROM run_history').run()
    database.prepare('DELETE FROM notes').run()
    database.prepare('DELETE FROM preferences').run()
    database.prepare('DELETE FROM engine_indexes').run()
    database.prepare('DELETE FROM engine_search_sessions').run()

    for (const project of payload.projects) {
      insertProject.run({
        id: project.id,
        path: project.path,
        name: project.name,
        type: project.type,
        icon: project.icon,
        linkedContainerNames: JSON.stringify(project.linkedContainerNames ?? []),
        isPinned: project.isPinned ? 1 : 0,
        pinnedAt: project.pinnedAt ?? null,
      })
    }

    for (const command of payload.commands) {
      insertCommand.run({
        id: command.id,
        name: command.name,
        command: command.command,
        description: command.description ?? null,
        tags: command.tags ? JSON.stringify(command.tags) : null,
        projectId: command.projectId ?? null,
        workingDirectory: command.workingDirectory ?? null,
        variables: command.variables ? JSON.stringify(command.variables) : null,
        isPinned: command.isPinned ? 1 : 0,
        pinnedAt: command.pinnedAt ?? null,
      })
    }

    for (const chain of payload.chains) {
      insertChain.run({
        id: chain.id,
        name: chain.name,
        description: chain.description ?? null,
        projectId: chain.projectId ?? null,
        steps: JSON.stringify(chain.steps ?? []),
        stopOnFailure: chain.stopOnFailure ? 1 : 0,
        parallel: chain.parallel ? 1 : 0,
        createdAt: chain.createdAt,
        updatedAt: chain.updatedAt,
      })
    }

    for (const trigger of payload.triggers) {
      insertTrigger.run({
        id: trigger.id,
        name: trigger.name,
        description: trigger.description ?? null,
        projectId: trigger.projectId ?? null,
        chainId: trigger.chainId,
        eventType: trigger.event,
        enabled: trigger.enabled ? 1 : 0,
        requireConfirmation: trigger.requireConfirmation ? 1 : 0,
        createdAt: trigger.createdAt,
        updatedAt: trigger.updatedAt,
      })
    }

    for (const entry of payload.runHistory) {
      insertRunHistory.run({
        id: entry.id,
        commandId: entry.commandId,
        projectId: entry.projectId ?? null,
        status: entry.status,
        startTime: entry.startTime,
        endTime: entry.endTime ?? null,
        output: entry.output ?? null,
        resolvedCommand: entry.resolvedCommand ?? null,
      })
    }

    for (const note of Object.values(payload.notes)) {
      insertNote.run({
        projectId: note.projectId,
        setupSteps: note.setupSteps,
        todos: note.todos,
        reminders: note.reminders,
      })
    }

    insertPreference.run({
      key: 'editor',
      id: payload.preferences.editor.id,
      command: payload.preferences.editor.command ?? null,
    })

    insertPreference.run({
      key: 'terminal',
      id: payload.preferences.terminal.id,
      command: payload.preferences.terminal.command ?? null,
    })

    insertPreference.run({
      key: 'tray',
      id: payload.preferences.trayEnabled !== false ? '1' : '0',
      command: null,
    })

    for (const entry of Object.values(payload.engineIndexes ?? {})) {
      insertEngineIndex.run({
        projectId: entry.projectId,
        dbPath: entry.dbPath,
        lastIndexed: entry.lastIndexed,
        fileCount: entry.fileCount,
      })
    }

    for (const session of Object.values(payload.engineSearchSessions ?? {})) {
      insertEngineSearchSession.run({
        projectId: session.projectId,
        query: session.query,
        regex: session.regex ? 1 : 0,
        updatedAt: session.updatedAt,
        resultJson: JSON.stringify(session.result),
      })
    }

    for (const report of payload.bugReports ?? []) {
      insertBugReport.run({
        id: report.id,
        projectId: report.projectId,
        title: report.title,
        severity: report.severity,
        status: report.status,
        expectedResult: report.expectedResult ?? null,
        actualResult: report.actualResult ?? null,
        reproductionSteps: report.reproductionSteps ?? null,
        notes: report.notes ?? null,
        resolutionNotes: report.resolutionNotes ?? null,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        resolvedAt: report.resolvedAt ?? null,
      })
    }
  })

  writeTransaction(store)
}

async function migrateJsonStoreIfNeeded(database: Database.Database, jsonPath: string) {
  const dbHasData = database
    .prepare('SELECT EXISTS(SELECT 1 FROM preferences LIMIT 1) AS has_data')
    .get() as { has_data: number }

  if (dbHasData.has_data) {
    return
  }

  try {
    const raw = await fs.readFile(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    writeStoreToDb(database, normalizeStore(parsed))
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
    if (code && code !== 'ENOENT') {
      await backupCorruptStore(jsonPath)
    }
    writeStoreToDb(database, createDefaultStore())
  }
}

export async function ensureDbInitialized(): Promise<void> {
  if (db) {
    return
  }

  if (!initPromise) {
    initPromise = (async () => {
      const dbPath = getDbPath()
      const jsonPath = getStorePath()
      await ensureStoreDir(dbPath)

      const database = new Database(dbPath)
      database.pragma('journal_mode = WAL')
      database.pragma('foreign_keys = ON')
      database.pragma('synchronous = NORMAL')
      createSchema(database)
      ensureSchemaCompatibility(database)

      await migrateJsonStoreIfNeeded(database, jsonPath)
      db = database
    })().catch((error) => {
      initPromise = null
      throw error
    })
  }

  await initPromise
}
