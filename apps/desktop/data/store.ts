import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { DATA_VERSION, type DataStore, type ProjectNotes } from './model'

const STORE_FILENAME = 'devdesk-store.json'

const createDefaultStore = (): DataStore => ({
  version: DATA_VERSION,
  projects: [],
  commands: [],
  runHistory: [],
  notes: {},
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

function normalizeStore(value: unknown): DataStore {
  if (!value || typeof value !== 'object') {
    return createDefaultStore()
  }

  const store = value as Partial<DataStore>
  const notes =
    store.notes && typeof store.notes === 'object' && !Array.isArray(store.notes)
      ? (store.notes as Record<string, ProjectNotes>)
      : {}

  return {
    version: DATA_VERSION,
    projects: Array.isArray(store.projects) ? store.projects : [],
    commands: Array.isArray(store.commands) ? store.commands : [],
    runHistory: Array.isArray(store.runHistory) ? store.runHistory : [],
    notes,
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
