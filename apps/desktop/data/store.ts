import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { DATA_VERSION, type AppPreferences, type DataStore, type ProjectNotes } from './model'

const STORE_FILENAME = 'devdesk-store.json'

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
  runHistory: [],
  notes: {},
  preferences: createDefaultPreferences(),
})

let cachedStore: DataStore | null = null
let loadPromise: Promise<DataStore> | null = null
let writeQueue = Promise.resolve<DataStore>(createDefaultStore())

function getStorePath(): string {
  if (!app.isReady()) {
    throw new Error('App not ready: cannot resolve userData path yet.')
  }
  return path.join(app.getPath('userData'), STORE_FILENAME)
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

function normalizeStore(value: unknown): DataStore {
  if (!value || typeof value !== 'object') {
    return createDefaultStore()
  }

  const store = value as Partial<DataStore>
  const notes = normalizeNotes(store.notes)

  const preferences = store.preferences && typeof store.preferences === 'object'
    ? (store.preferences as Partial<AppPreferences>)
    : undefined
  const rawEngineIndexes =
    store.engineIndexes && typeof store.engineIndexes === 'object' && !Array.isArray(store.engineIndexes)
      ? store.engineIndexes
      : undefined
  const rawEngineSearchSessions =
    store.engineSearchSessions && typeof store.engineSearchSessions === 'object' && !Array.isArray(store.engineSearchSessions)
      ? store.engineSearchSessions
      : undefined
  const engineIndexes = rawEngineIndexes
    ? Object.entries(rawEngineIndexes).reduce<NonNullable<DataStore['engineIndexes']>>((acc, [projectId, entry]) => {
        if (!entry || typeof entry !== 'object') {
          return acc
        }

        const rawEntry = entry as unknown as Record<string, unknown>
        const dbPath = typeof rawEntry.dbPath === 'string' ? rawEntry.dbPath : ''
        const lastIndexed = typeof rawEntry.lastIndexed === 'string' ? rawEntry.lastIndexed : ''
        const fileCount = typeof rawEntry.fileCount === 'number' ? rawEntry.fileCount : 0

        if (!dbPath || !lastIndexed) {
          return acc
        }

        acc[projectId] = {
          projectId,
          dbPath,
          lastIndexed,
          fileCount,
        }

        return acc
      }, {})
    : undefined
  const engineSearchSessions = rawEngineSearchSessions
    ? Object.entries(rawEngineSearchSessions).reduce<NonNullable<DataStore['engineSearchSessions']>>((acc, [projectId, entry]) => {
        if (!entry || typeof entry !== 'object') {
          return acc
        }

        const rawEntry = entry as unknown as Record<string, unknown>
        const query = typeof rawEntry.query === 'string' ? rawEntry.query : ''
        const regex = typeof rawEntry.regex === 'boolean' ? rawEntry.regex : false
        const updatedAt = typeof rawEntry.updatedAt === 'string' ? rawEntry.updatedAt : ''
        const rawResult = rawEntry.result

        if (!query || !updatedAt || !rawResult || typeof rawResult !== 'object') {
          return acc
        }

        const result = rawResult as Record<string, unknown>
        const resultQuery = typeof result.query === 'string' ? result.query : query
        const totalMatches = typeof result.totalMatches === 'number' ? result.totalMatches : 0
        const durationMs = typeof result.durationMs === 'number' ? result.durationMs : 0
        const rawResults = Array.isArray(result.results) ? result.results : []

        acc[projectId] = {
          projectId,
          query,
          regex,
          updatedAt,
          result: {
            ok: result.ok !== false,
            query: resultQuery,
            totalMatches,
            durationMs,
            results: rawResults.map((item) => {
              const rawItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
              const rawMatches = Array.isArray(rawItem.matches) ? rawItem.matches : []
              return {
                path: typeof rawItem.path === 'string' ? rawItem.path : '',
                language: typeof rawItem.language === 'string' ? rawItem.language : null,
                score: typeof rawItem.score === 'number' ? rawItem.score : 0,
                matches: rawMatches.map((match) => {
                  const rawMatch = match && typeof match === 'object' ? (match as Record<string, unknown>) : {}
                  return {
                    line: typeof rawMatch.line === 'number' ? rawMatch.line : 1,
                    column: typeof rawMatch.column === 'number' ? rawMatch.column : 1,
                    snippet: typeof rawMatch.snippet === 'string' ? rawMatch.snippet : '',
                    contextBefore: Array.isArray(rawMatch.contextBefore)
                      ? rawMatch.contextBefore.filter((value): value is string => typeof value === 'string')
                      : [],
                    contextAfter: Array.isArray(rawMatch.contextAfter)
                      ? rawMatch.contextAfter.filter((value): value is string => typeof value === 'string')
                      : [],
                  }
                }),
              }
            }).filter((item) => item.path),
          },
        }

        return acc
      }, {})
    : undefined

  return {
    version: DATA_VERSION,
    projects: Array.isArray(store.projects) ? store.projects : [],
    commands: Array.isArray(store.commands) ? store.commands : [],
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
    engineIndexes,
    engineSearchSessions,
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

async function readStoreFromDisk(): Promise<DataStore> {
  const filePath = getStorePath()
  await ensureStoreDir(filePath)

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const normalized = normalizeStore(parsed)
    cachedStore = normalized
    return normalized
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
    if (code !== 'ENOENT') {
      await backupCorruptStore(filePath)
    }

    const fresh = createDefaultStore()
    await writeStoreToDisk(fresh)
    cachedStore = fresh
    return fresh
  }
}

async function writeStoreToDisk(store: DataStore): Promise<void> {
  const filePath = getStorePath()
  await ensureStoreDir(filePath)

  const tmpPath = `${filePath}.tmp`
  const payload = `${JSON.stringify(store, null, 2)}\n`
  await fs.writeFile(tmpPath, payload, 'utf-8')

  try {
    await fs.rename(tmpPath, filePath)
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
    if (code === 'EEXIST') {
      await fs.unlink(filePath)
      await fs.rename(tmpPath, filePath)
      return
    }
    throw error
  }
}

export async function getStore(): Promise<DataStore> {
  if (cachedStore) return cachedStore
  if (!loadPromise) {
    loadPromise = readStoreFromDisk()
  }
  return loadPromise
}

export async function updateStore(updater: (draft: DataStore) => void): Promise<DataStore> {
  writeQueue = writeQueue.then(async () => {
    const current = await getStore()
    const next = structuredClone(current)
    updater(next)
    await writeStoreToDisk(next)
    cachedStore = next
    return next
  })

  return writeQueue
}

export async function reconcileRunHistory(): Promise<void> {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    draft.runHistory.forEach((entry) => {
      if (entry.status === 'running') {
        entry.status = 'stopped'
        entry.endTime = entry.endTime ?? now
      }
    })
  })
}
