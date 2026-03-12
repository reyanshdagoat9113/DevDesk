import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'

import {
  DATA_VERSION,
  type AppPreferences,
  type ChainStep,
  type Command,
  type CommandChain,
  type CommandTrigger,
  type CommandTriggerEvent,
  type CommandVariable,
  type DataStore,
  type Project,
  type ProjectNotes,
  type RunHistoryEntry,
  type RunStatus,
} from './model'

const STORE_FILENAME = 'devdesk-store.json'
const DB_FILENAME = 'devdesk.db'
const SQL_DEBUG = process.env.DEVDESK_SQL_DEBUG === '1'
const SQL_SLOW_MS = Number.parseInt(process.env.DEVDESK_SQL_SLOW_MS ?? '20', 10)

const VALID_PROJECT_TYPES = new Set(['node', 'python', 'rust', 'go', 'unknown'])
const VALID_TRIGGER_EVENTS = new Set<CommandTriggerEvent>(['onProjectOpen', 'afterContainerStart', 'onStartup'])

function parseBoolean(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return Boolean(value)
}

const createDefaultPreferences = (): AppPreferences => {
  if (process.platform === 'win32') {
    return {
      editor: { id: 'vscode' },
      terminal: { id: 'windows-terminal' },
    }
  }
  if (process.platform === 'darwin') {
    return {
      editor: { id: 'vscode' },
      terminal: { id: 'terminal' },
    }
  }
  return {
    editor: { id: 'vscode' },
    terminal: { id: 'terminal' },
  }
}

const createDefaultStore = (): DataStore => ({
  version: DATA_VERSION,
  projects: [],
  commands: [],
  chains: [],
  triggers: [],
  runHistory: [],
  notes: {},
  preferences: createDefaultPreferences(),
})

let initPromise: Promise<void> | null = null
let db: Database.Database | null = null
let writeQueue = Promise.resolve()

function getUserDataDir(): string {
  if (!app.isReady()) {
    throw new Error('App not ready: cannot resolve userData path yet.')
  }
  return app.getPath('userData')
}

function getStorePath(): string {
  return path.join(getUserDataDir(), STORE_FILENAME)
}

function getDbPath(): string {
  const configuredName = process.env.DEVDESK_DB_FILENAME?.trim()
  const fileName = configuredName || DB_FILENAME
  return path.join(getUserDataDir(), fileName)
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  } catch {
    return []
  }
}

function parseVariables(value: string | null | undefined): CommandVariable[] | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return undefined
    }
    return parsed.filter((item): item is CommandVariable => 
      typeof item === 'object' && 
      item !== null &&
      typeof item.name === 'string' &&
      typeof item.required === 'boolean'
    )
  } catch {
    return undefined
  }
}

function parseChainStepVariables(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'
  )

  if (!entries.length) {
    return undefined
  }

  return Object.fromEntries(entries)
}

function parseChainSteps(value: string | null | undefined): ChainStep[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.reduce<ChainStep[]>((acc, item) => {
      if (!item || typeof item !== 'object') {
        return acc
      }

      const raw = item as Partial<ChainStep>
      if (typeof raw.id !== 'string' || typeof raw.commandId !== 'string') {
        return acc
      }

      acc.push({
        id: raw.id,
        commandId: raw.commandId,
        variables: parseChainStepVariables(raw.variables),
        delayMs:
          typeof raw.delayMs === 'number' && Number.isFinite(raw.delayMs) && raw.delayMs > 0
            ? Math.max(0, Math.floor(raw.delayMs))
            : undefined,
      })
      return acc
    }, [])
  } catch {
    return []
  }
}

function normalizeChains(value: unknown): CommandChain[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<CommandChain[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const raw = entry as Partial<CommandChain>
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
      return acc
    }

    acc.push({
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
      steps: Array.isArray(raw.steps) ? parseChainSteps(JSON.stringify(raw.steps)) : [],
      stopOnFailure: raw.stopOnFailure !== false,
      parallel: raw.parallel === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    })

    return acc
  }, [])
}

function normalizeTriggers(value: unknown): CommandTrigger[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<CommandTrigger[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const raw = entry as Partial<CommandTrigger>
    if (
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      typeof raw.chainId !== 'string' ||
      typeof raw.event !== 'string' ||
      !VALID_TRIGGER_EVENTS.has(raw.event as CommandTriggerEvent)
    ) {
      return acc
    }

    acc.push({
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
      chainId: raw.chainId,
      event: raw.event as CommandTriggerEvent,
      enabled: raw.enabled !== false,
      requireConfirmation: raw.requireConfirmation === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    })

    return acc
  }, [])
}

function normalizeNotes(value: unknown): Record<string, ProjectNotes> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
  return entries.reduce<Record<string, ProjectNotes>>((acc, [projectId, note]) => {
    if (!note || typeof note !== 'object') {
      acc[projectId] = { projectId, setupSteps: '', todos: '', reminders: '' }
      return acc
    }

    const raw = note as Record<string, unknown>
    const setupSteps = typeof raw.setupSteps === 'string' ? raw.setupSteps : ''
    const todos = typeof raw.todos === 'string' ? raw.todos : ''
    const reminders = typeof raw.reminders === 'string' ? raw.reminders : ''
    const ports = typeof raw.ports === 'string' ? raw.ports : ''
    const urls = typeof raw.urls === 'string' ? raw.urls : ''

    let mergedSetupSteps = setupSteps
    if (!mergedSetupSteps && (ports || urls)) {
      const sections: string[] = []
      if (ports) {
        sections.push(`Ports:\n${ports}`)
      }
      if (urls) {
        sections.push(`URLs:\n${urls}`)
      }
      mergedSetupSteps = sections.join('\n\n')
    }

    acc[projectId] = {
      projectId,
      setupSteps: mergedSetupSteps,
      todos,
      reminders,
    }
    return acc
  }, {})
}

function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const raw = entry as Partial<Project> & { linkedContainerNames?: unknown }
      if (
        typeof raw.id !== 'string' ||
        typeof raw.path !== 'string' ||
        typeof raw.name !== 'string' ||
        typeof raw.type !== 'string' ||
        typeof raw.icon !== 'string'
      ) {
        return null
      }

      if (!VALID_PROJECT_TYPES.has(raw.type)) {
        return null
      }

      return {
        id: raw.id,
        path: raw.path,
        name: raw.name,
        type: raw.type,
        icon: raw.icon,
        linkedContainerNames: Array.isArray(raw.linkedContainerNames)
          ? raw.linkedContainerNames.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
          : [],
      } satisfies Project
    })
    .filter((project): project is Project => Boolean(project))
}

function normalizeStore(value: unknown): DataStore {
  if (!value || typeof value !== 'object') {
    return createDefaultStore()
  }

  const store = value as Partial<DataStore>
  const notes = normalizeNotes(store.notes)

  const preferences = store.preferences && typeof store.preferences === 'object'
    ? (store.preferences as Partial<AppPreferences>)
    : undefined

  return {
    version: DATA_VERSION,
    projects: normalizeProjects(store.projects),
    commands: Array.isArray(store.commands) ? store.commands : [],
    chains: normalizeChains(store.chains),
    triggers: normalizeTriggers(store.triggers),
    runHistory: Array.isArray(store.runHistory) ? store.runHistory : [],
    notes,
    preferences: {
      editor: {
        id: preferences?.editor?.id ?? createDefaultPreferences().editor.id,
        command: preferences?.editor?.command,
      },
      terminal: {
        id: preferences?.terminal?.id ?? createDefaultPreferences().terminal.id,
        command: preferences?.terminal?.command,
      },
    },
  }
}

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

function getDbOrThrow(): Database.Database {
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

    CREATE INDEX IF NOT EXISTS idx_commands_project_id ON commands(project_id);
    CREATE INDEX IF NOT EXISTS idx_chains_project_id ON chains(project_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_project_id ON triggers(project_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_chain_id ON triggers(chain_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_event_type ON triggers(event_type);
    CREATE INDEX IF NOT EXISTS idx_run_history_start_time ON run_history(start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_run_history_command_id ON run_history(command_id);
    CREATE INDEX IF NOT EXISTS idx_run_history_project_id ON run_history(project_id);
  `)
}

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === columnName)
}

function ensureSchemaCompatibility(database: Database.Database) {
  // Existing user databases may predate newer columns added after initial table creation.
  if (!hasColumn(database, 'commands', 'variables')) {
    database.exec('ALTER TABLE commands ADD COLUMN variables TEXT')
  }

  if (!hasColumn(database, 'run_history', 'resolved_command')) {
    database.exec('ALTER TABLE run_history ADD COLUMN resolved_command TEXT')
  }

  // Phase 1.3: Favorites/Pinning
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

  const writeTransaction = database.transaction((payload: DataStore) => {
      database.prepare('DELETE FROM projects').run()
      database.prepare('DELETE FROM commands').run()
      database.prepare('DELETE FROM chains').run()
      database.prepare('DELETE FROM triggers').run()
      database.prepare('DELETE FROM run_history').run()
      database.prepare('DELETE FROM notes').run()
      database.prepare('DELETE FROM preferences').run()

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

async function ensureDbInitialized(): Promise<void> {
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

function queueWrite<T>(writer: () => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(() => writer())
  writeQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function withSqlTiming<T>(label: string, operation: () => T | Promise<T>): Promise<T> {
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

export async function reconcileRunHistory(): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(`
        UPDATE run_history
        SET status = 'stopped', end_time = COALESCE(end_time, ?)
        WHERE status = 'running'
      `)
      .run(new Date().toISOString())
  })
}

export async function createProject(project: Project): Promise<void> {
  await queueWrite(async () => withSqlTiming('createProject', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO projects (id, path, name, type, icon, linked_container_names, is_pinned, pinned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        project.id,
        project.path,
        project.name,
        project.type,
        project.icon,
        JSON.stringify(project.linkedContainerNames ?? []),
        project.isPinned ? 1 : 0,
        project.pinnedAt ?? null
      )
  }))
}

export async function removeProject(projectId: string): Promise<void> {
  await queueWrite(async () => withSqlTiming('removeProject', async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const transaction = database.transaction((id: string) => {
      database.prepare('DELETE FROM projects WHERE id = ?').run(id)
      database.prepare('DELETE FROM commands WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM chains WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM triggers WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM run_history WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM notes WHERE project_id = ?').run(id)
    })
    transaction(projectId)
  }))
}

export async function renameProject(projectId: string, name: string): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare('UPDATE projects SET name = ? WHERE id = ?')
      .run(name, projectId)
    if (result.changes > 0) {
      return true
    }
    return false
  })
}

export async function updateProjectLinkedContainers(projectId: string, linkedContainerNames: string[]): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare('UPDATE projects SET linked_container_names = ? WHERE id = ?')
      .run(JSON.stringify(linkedContainerNames), projectId)
    if (result.changes > 0) {
      return true
    }
    return false
  })
}

export async function updatePreferencesInStore(updates: Partial<AppPreferences>): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const current = await getPreferencesFromStore()
    const next = {
      editor: {
        id: updates.editor?.id ?? current.editor.id,
        command: updates.editor?.command ?? current.editor.command,
      },
      terminal: {
        id: updates.terminal?.id ?? current.terminal.id,
        command: updates.terminal?.command ?? current.terminal.command,
      },
    }
    const upsert = database.prepare(
      `
        INSERT INTO preferences (key, id, command)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET id = excluded.id, command = excluded.command
      `
    )
    const transaction = database.transaction(() => {
      upsert.run('editor', next.editor.id, next.editor.command ?? null)
      upsert.run('terminal', next.terminal.id, next.terminal.command ?? null)
    })
    transaction()
  })
}

export async function createCommand(command: Command): Promise<void> {
  await queueWrite(async () => withSqlTiming('createCommand', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO commands (id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        command.id,
        command.name,
        command.command,
        command.description ?? null,
        command.tags ? JSON.stringify(command.tags) : null,
        command.projectId ?? null,
        command.workingDirectory ?? null,
        command.variables ? JSON.stringify(command.variables) : null,
        command.isPinned ? 1 : 0,
        command.pinnedAt ?? null
      )
  }))
}

export async function replaceCommand(command: Command): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE commands
          SET name = ?, command = ?, description = ?, tags = ?, project_id = ?, working_directory = ?, variables = ?, is_pinned = ?, pinned_at = ?
          WHERE id = ?
        `
      )
      .run(
        command.name,
        command.command,
        command.description ?? null,
        command.tags ? JSON.stringify(command.tags) : null,
        command.projectId ?? null,
        command.workingDirectory ?? null,
        command.variables ? JSON.stringify(command.variables) : null,
        command.isPinned ? 1 : 0,
        command.pinnedAt ?? null,
        command.id
      )
    if (result.changes > 0) {
      return true
    }
    return false
  })
}

export async function removeCommand(commandId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM commands WHERE id = ?').run(commandId)
  })
}

export async function createChain(chain: CommandChain): Promise<void> {
  await queueWrite(async () => withSqlTiming('createChain', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO chains (id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        chain.id,
        chain.name,
        chain.description ?? null,
        chain.projectId ?? null,
        JSON.stringify(chain.steps ?? []),
        chain.stopOnFailure ? 1 : 0,
        chain.parallel ? 1 : 0,
        chain.createdAt,
        chain.updatedAt
      )
  }))
}

export async function replaceChain(chain: CommandChain): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE chains
          SET name = ?, description = ?, project_id = ?, steps = ?, stop_on_failure = ?, parallel = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        chain.name,
        chain.description ?? null,
        chain.projectId ?? null,
        JSON.stringify(chain.steps ?? []),
        chain.stopOnFailure ? 1 : 0,
        chain.parallel ? 1 : 0,
        chain.updatedAt,
        chain.id
      )
    return result.changes > 0
  })
}

export async function removeChain(chainId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const transaction = database.transaction((id: string) => {
      database.prepare('DELETE FROM triggers WHERE chain_id = ?').run(id)
      database.prepare('DELETE FROM chains WHERE id = ?').run(id)
    })
    transaction(chainId)
  })
}

export async function createTrigger(trigger: CommandTrigger): Promise<void> {
  await queueWrite(async () => withSqlTiming('createTrigger', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO triggers (id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        trigger.id,
        trigger.name,
        trigger.description ?? null,
        trigger.projectId ?? null,
        trigger.chainId,
        trigger.event,
        trigger.enabled ? 1 : 0,
        trigger.requireConfirmation ? 1 : 0,
        trigger.createdAt,
        trigger.updatedAt
      )
  }))
}

export async function replaceTrigger(trigger: CommandTrigger): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE triggers
          SET name = ?, description = ?, project_id = ?, chain_id = ?, event_type = ?, enabled = ?, require_confirmation = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        trigger.name,
        trigger.description ?? null,
        trigger.projectId ?? null,
        trigger.chainId,
        trigger.event,
        trigger.enabled ? 1 : 0,
        trigger.requireConfirmation ? 1 : 0,
        trigger.updatedAt,
        trigger.id
      )
    return result.changes > 0
  })
}

export async function removeTrigger(triggerId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM triggers WHERE id = ?').run(triggerId)
  })
}

export async function createRunHistoryEntry(entry: RunHistoryEntry): Promise<void> {
  await queueWrite(async () => withSqlTiming('createRunHistoryEntry', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO run_history (id, command_id, project_id, status, start_time, end_time, output, resolved_command)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        entry.id,
        entry.commandId,
        entry.projectId ?? null,
        entry.status,
        entry.startTime,
        entry.endTime ?? null,
        entry.output ?? null,
        entry.resolvedCommand ?? null
      )
  }))
}

export async function finalizeRunHistoryEntry(runId: string, output: string, status?: RunStatus): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    if (status) {
      getDbOrThrow()
        .prepare('UPDATE run_history SET output = ?, status = ?, end_time = ? WHERE id = ?')
        .run(output, status, new Date().toISOString(), runId)
    } else {
      getDbOrThrow().prepare('UPDATE run_history SET output = ? WHERE id = ?').run(output, runId)
    }
  })
}

export async function clearRunHistoryInStore(): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM run_history').run()
  })
}

export async function removeRunHistoryEntry(runId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM run_history WHERE id = ?').run(runId)
  })
}

export async function getRunHistoryOutputById(runId: string): Promise<string> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT output FROM run_history WHERE id = ?')
    .get(runId) as { output: string | null } | undefined
  return row?.output ?? ''
}

export async function listRecentRunHistory(limit: number): Promise<Array<Omit<RunHistoryEntry, 'output'>>> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT id, command_id, project_id, status, start_time, end_time, resolved_command
        FROM run_history
        ORDER BY start_time DESC, rowid DESC
        LIMIT ?
      `
    )
    .all(limit) as Array<{
    id: string
    command_id: string
    project_id: string | null
    status: RunStatus
    start_time: string
    end_time: string | null
    resolved_command: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    commandId: row.command_id,
    projectId: row.project_id ?? undefined,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    resolvedCommand: row.resolved_command ?? undefined,
  }))
}

export async function getProjectNotesById(projectId: string): Promise<ProjectNotes> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT project_id, setup_steps, todos, reminders FROM notes WHERE project_id = ?')
    .get(projectId) as { project_id: string; setup_steps: string; todos: string; reminders: string } | undefined

  if (!row) {
    return {
      projectId,
      setupSteps: '',
      todos: '',
      reminders: '',
    }
  }

  return {
    projectId: row.project_id,
    setupSteps: row.setup_steps,
    todos: row.todos,
    reminders: row.reminders,
  }
}

export async function upsertProjectNotes(projectId: string, updates: Partial<ProjectNotes>): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const current = await getProjectNotesById(projectId)
    const next = {
      projectId,
      setupSteps: updates.setupSteps ?? current.setupSteps,
      todos: updates.todos ?? current.todos,
      reminders: updates.reminders ?? current.reminders,
    }

    getDbOrThrow()
      .prepare(
        `
          INSERT INTO notes (project_id, setup_steps, todos, reminders)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            setup_steps = excluded.setup_steps,
            todos = excluded.todos,
            reminders = excluded.reminders
        `
      )
      .run(projectId, next.setupSteps, next.todos, next.reminders)

  })
}

export async function listProjects(): Promise<Project[]> {
  return withSqlTiming('listProjects', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, path, name, type, icon, linked_container_names, is_pinned, pinned_at FROM projects ORDER BY rowid ASC')
      .all() as Array<{
      id: string
      path: string
      name: string
      type: Project['type']
      icon: string
      linked_container_names: string | null
      is_pinned: number
      pinned_at: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      name: row.name,
      type: VALID_PROJECT_TYPES.has(row.type) ? row.type : 'unknown',
      icon: row.icon,
      linkedContainerNames: parseJsonArray(row.linked_container_names),
      isPinned: parseBoolean(row.is_pinned),
      pinnedAt: row.pinned_at ?? undefined,
    }))
  })
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT id, path, name, type, icon, linked_container_names, is_pinned, pinned_at FROM projects WHERE id = ?')
    .get(projectId) as {
    id: string
    path: string
    name: string
    type: Project['type']
    icon: string
    linked_container_names: string | null
    is_pinned: number
    pinned_at: string | null
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    path: row.path,
    name: row.name,
    type: VALID_PROJECT_TYPES.has(row.type) ? row.type : 'unknown',
    icon: row.icon,
    linkedContainerNames: parseJsonArray(row.linked_container_names),
    isPinned: parseBoolean(row.is_pinned),
    pinnedAt: row.pinned_at ?? undefined,
  }
}

export async function listCommands(): Promise<Command[]> {
  return withSqlTiming('listCommands', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at FROM commands ORDER BY rowid ASC')
      .all() as Array<{
      id: string
      name: string
      command: string
      description: string | null
      tags: string | null
      project_id: string | null
      working_directory: string | null
      variables: string | null
      is_pinned: number
      pinned_at: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      command: row.command,
      description: row.description ?? undefined,
      tags: parseJsonArray(row.tags),
      projectId: row.project_id ?? undefined,
      workingDirectory: row.working_directory ?? undefined,
      variables: parseVariables(row.variables),
      isPinned: parseBoolean(row.is_pinned),
      pinnedAt: row.pinned_at ?? undefined,
    }))
  })
}

export async function getCommandById(commandId: string): Promise<Command | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at FROM commands WHERE id = ?')
    .get(commandId) as {
    id: string
    name: string
    command: string
    description: string | null
    tags: string | null
    project_id: string | null
    working_directory: string | null
    variables: string | null
    is_pinned: number
    pinned_at: string | null
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    command: row.command,
    description: row.description ?? undefined,
    tags: parseJsonArray(row.tags),
    projectId: row.project_id ?? undefined,
    workingDirectory: row.working_directory ?? undefined,
    variables: parseVariables(row.variables),
    isPinned: parseBoolean(row.is_pinned),
    pinnedAt: row.pinned_at ?? undefined,
  }
}

export async function getPreferencesFromStore(): Promise<AppPreferences> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare('SELECT key, id, command FROM preferences WHERE key IN (?, ?)')
    .all('editor', 'terminal') as Array<{ key: 'editor' | 'terminal'; id: string; command: string | null }>

  const defaults = createDefaultPreferences()
  const preferenceMap = new Map(rows.map((entry) => [entry.key, entry]))
  return {
    editor: {
      id: preferenceMap.get('editor')?.id ?? defaults.editor.id,
      command: preferenceMap.get('editor')?.command ?? defaults.editor.command,
    },
    terminal: {
      id: preferenceMap.get('terminal')?.id ?? defaults.terminal.id,
      command: preferenceMap.get('terminal')?.command ?? defaults.terminal.command,
    },
  }
}

export async function listChains(): Promise<CommandChain[]> {
  return withSqlTiming('listChains', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare(
        `
          SELECT id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at
          FROM chains
          ORDER BY rowid ASC
        `
      )
      .all() as Array<{
      id: string
      name: string
      description: string | null
      project_id: string | null
      steps: string
      stop_on_failure: number
      parallel: number
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      projectId: row.project_id ?? undefined,
      steps: parseChainSteps(row.steps),
      stopOnFailure: parseBoolean(row.stop_on_failure),
      parallel: parseBoolean(row.parallel),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  })
}

export async function getChainById(chainId: string): Promise<CommandChain | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare(
      `
        SELECT id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at
        FROM chains
        WHERE id = ?
      `
    )
    .get(chainId) as {
    id: string
    name: string
    description: string | null
    project_id: string | null
    steps: string
    stop_on_failure: number
    parallel: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    projectId: row.project_id ?? undefined,
    steps: parseChainSteps(row.steps),
    stopOnFailure: parseBoolean(row.stop_on_failure),
    parallel: parseBoolean(row.parallel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listTriggers(): Promise<CommandTrigger[]> {
  return withSqlTiming('listTriggers', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare(
        `
          SELECT id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at
          FROM triggers
          ORDER BY rowid ASC
        `
      )
      .all() as Array<{
      id: string
      name: string
      description: string | null
      project_id: string | null
      chain_id: string
      event_type: CommandTriggerEvent
      enabled: number
      require_confirmation: number
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      projectId: row.project_id ?? undefined,
      chainId: row.chain_id,
      event: row.event_type,
      enabled: parseBoolean(row.enabled),
      requireConfirmation: parseBoolean(row.require_confirmation),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  })
}

export async function getTriggerById(triggerId: string): Promise<CommandTrigger | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare(
      `
        SELECT id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at
        FROM triggers
        WHERE id = ?
      `
    )
    .get(triggerId) as {
    id: string
    name: string
    description: string | null
    project_id: string | null
    chain_id: string
    event_type: CommandTriggerEvent
    enabled: number
    require_confirmation: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    projectId: row.project_id ?? undefined,
    chainId: row.chain_id,
    event: row.event_type,
    enabled: parseBoolean(row.enabled),
    requireConfirmation: parseBoolean(row.require_confirmation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listRunHistory(): Promise<RunHistoryEntry[]> {
  return withSqlTiming('listRunHistory', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, command_id, project_id, status, start_time, end_time, output, resolved_command FROM run_history ORDER BY start_time DESC, rowid DESC')
      .all() as Array<{
      id: string
      command_id: string
      project_id: string | null
      status: RunStatus
      start_time: string
      end_time: string | null
      output: string | null
      resolved_command: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      commandId: row.command_id,
      projectId: row.project_id ?? undefined,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      output: row.output ?? undefined,
      resolvedCommand: row.resolved_command ?? undefined,
    }))
  })
}

export async function toggleProjectPin(projectId: string): Promise<Project | null> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()

    // Get current pin state
    const row = database
      .prepare('SELECT is_pinned, pinned_at FROM projects WHERE id = ?')
      .get(projectId) as { is_pinned: number; pinned_at: string | null } | undefined

    if (!row) {
      return null
    }

    const isCurrentlyPinned = parseBoolean(row.is_pinned)
    const newPinnedState = !isCurrentlyPinned
    const newPinnedAt = newPinnedState ? new Date().toISOString() : null

    database
      .prepare('UPDATE projects SET is_pinned = ?, pinned_at = ? WHERE id = ?')
      .run(newPinnedState ? 1 : 0, newPinnedAt, projectId)

    return getProjectById(projectId)
  })
}

export async function toggleCommandPin(commandId: string): Promise<Command | null> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()

    // Get current pin state
    const row = database
      .prepare('SELECT is_pinned, pinned_at FROM commands WHERE id = ?')
      .get(commandId) as { is_pinned: number; pinned_at: string | null } | undefined

    if (!row) {
      return null
    }

    const isCurrentlyPinned = parseBoolean(row.is_pinned)
    const newPinnedState = !isCurrentlyPinned
    const newPinnedAt = newPinnedState ? new Date().toISOString() : null

    database
      .prepare('UPDATE commands SET is_pinned = ?, pinned_at = ? WHERE id = ?')
      .run(newPinnedState ? 1 : 0, newPinnedAt, commandId)

    return getCommandById(commandId)
  })
}
