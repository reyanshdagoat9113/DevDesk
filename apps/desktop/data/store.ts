import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { DATA_VERSION, type AppPreferences, type DataStore, type Project, type ProjectNotes } from './model'

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
      const validTypes = new Set(['node', 'python', 'rust', 'go', 'unknown'])
      if (!validTypes.has(raw.type)) {
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
