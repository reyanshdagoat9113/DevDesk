import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test, vi } from 'vitest'
import * as realEngine from 'devdesk-engine'
import type { Project } from '../data/model'

const ipcHandlers = new Map<string, (...args: any[]) => Promise<unknown> | unknown>()
const ipcListeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>()
let exposedElectronApi: Record<string, any> | null = null

let tempRoot = ''
let projectRoot = ''
let userDataRoot = ''
let projectId = 'fixture-project'
let projectRecord: Project
let engineIndexes: Record<string, any> = {}
let engineSearchSessions: Record<string, any> = {}

function emit(channel: string, payload: unknown) {
  const listeners = ipcListeners.get(channel)
  if (!listeners) return

  for (const listener of listeners) {
    listener({ sender: { send: emit } }, payload)
  }
}

function resetMockState() {
  ipcHandlers.clear()
  ipcListeners.clear()
  exposedElectronApi = null
  engineIndexes = {}
  engineSearchSessions = {}
}

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown> | unknown) => {
      ipcHandlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      ipcHandlers.delete(channel)
    }),
  },
  ipcRenderer: {
    invoke: vi.fn(async (channel: string, ...args: any[]) => {
      const handler = ipcHandlers.get(channel)
      if (!handler) {
        throw new Error(`No IPC handler registered for ${channel}`)
      }

      return handler(
        {
          sender: {
            send: emit,
          },
        },
        ...args,
      )
    }),
    on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
      if (!ipcListeners.has(channel)) {
        ipcListeners.set(channel, new Set())
      }
      ipcListeners.get(channel)?.add(listener)
    }),
    removeListener: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
      ipcListeners.get(channel)?.delete(listener)
    }),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, api: Record<string, any>) => {
      if (name === 'electronAPI') {
        exposedElectronApi = api
      }
    }),
  },
}))

vi.mock('../data/store', () => {
  const noopAsync = async () => undefined
  const noopAsyncArray = async () => []

  return {
    clearEngineIndexMeta: async (projectIdValue: string) => {
      delete engineIndexes[projectIdValue]
    },
    clearEngineSearchSession: async (projectIdValue: string) => {
      delete engineSearchSessions[projectIdValue]
    },
    clearRunHistoryInStore: noopAsync,
    createChain: async () => undefined,
    createCommand: async () => undefined,
    createProject: async () => projectRecord,
    createRunHistoryEntry: async () => undefined,
    createTrigger: async () => undefined,
    finalizeRunHistoryEntry: async () => undefined,
    getChainById: async () => undefined,
    getCommandById: async () => undefined,
    getPreferencesFromStore: async () => ({ editor: { id: 'editor' }, terminal: { id: 'terminal' } }),
    getProjectById: async (id: string) => (id === projectId ? projectRecord : undefined),
    getProjectNotesById: async () => undefined,
    getRunHistoryOutputById: async () => undefined,
    getTriggerById: async () => undefined,
    listChains: noopAsyncArray,
    listCommands: noopAsyncArray,
    listEngineIndexes: async () => ({ ...engineIndexes }),
    listEngineSearchSessions: async () => ({ ...engineSearchSessions }),
    listProjects: async () => [projectRecord],
    listRecentRunHistory: noopAsyncArray,
    listRunHistory: noopAsyncArray,
    listTriggers: noopAsyncArray,
    reconcileRunHistory: noopAsync,
    removeChain: noopAsync,
    removeCommand: noopAsync,
    removeProject: noopAsync,
    removeRunHistoryEntry: noopAsync,
    removeTrigger: noopAsync,
    renameProject: async () => projectRecord,
    replaceChain: async () => undefined,
    replaceCommand: async () => undefined,
    replaceTrigger: async () => undefined,
    toggleCommandPin: async () => undefined,
    toggleProjectPin: async () => projectRecord,
    updatePreferencesInStore: noopAsync,
    updateProjectLinkedContainers: noopAsync,
    upsertEngineIndex: async (entry: any) => {
      engineIndexes[entry.projectId] = entry
      return entry
    },
    upsertEngineSearchSession: async (session: any) => {
      engineSearchSessions[session.projectId] = session
      return session
    },
    upsertProjectNotes: noopAsync,
  }
})

vi.mock('../engine/binary', () => ({
  engineGit: async () => ({ ok: true, path: projectRoot, branch: 'main', hotspots: [], contributors: [], totalCommits: 0 }),
  engineIndex: async (repoPath: string, projectIdValue: string) => {
    const dbPath = path.join(userDataRoot, 'engine', `${projectIdValue}.sqlite`)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    return realEngine.indexRepository({ repo: repoPath, db: dbPath, incremental: false })
  },
  engineSearch: async (projectIdValue: string, query: string, options?: { regex?: boolean; limit?: number }) => {
    const dbPath = path.join(userDataRoot, 'engine', `${projectIdValue}.sqlite`)
    return realEngine.searchIndex({ db: dbPath, query, regex: options?.regex, limit: options?.limit })
  },
  engineStats: async (projectIdValue: string) => {
    const dbPath = path.join(userDataRoot, 'engine', `${projectIdValue}.sqlite`)
    return realEngine.getStats(dbPath)
  },
  getEngineDbPath: (projectIdValue: string) => path.join(userDataRoot, 'engine', `${projectIdValue}.sqlite`),
  getEngineStatus: async () => ({ available: true, version: 'test-suite' }),
}))

beforeEach(() => {
  resetMockState()
  tempRoot = path.join(os.tmpdir(), `devdesk-engine-ipc-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  projectRoot = path.join(tempRoot, 'fixture-project')
  userDataRoot = path.join(tempRoot, 'user-data')
  projectId = 'fixture-project'
  projectRecord = {
    id: projectId,
    path: projectRoot,
    name: 'Fixture Project',
    type: 'node',
    icon: 'box',
    linkedContainerNames: [],
    isPinned: false,
    pinnedAt: undefined,
  }

  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(projectRoot, 'src', 'app.ts'), 'export const needle = true\n')
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Fixture\n')
})

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

test('Electron IPC exposes engine index, search, and stats flows', async () => {
  const { registerIpcHandlers } = await import('../ipc/registerIpc')
  await import('../preload')

  registerIpcHandlers()

  assert.ok(exposedElectronApi, 'electronAPI should be exposed by preload')
  const electronAPI = exposedElectronApi!

  const initialState = await electronAPI.getEngineState()
  assert.equal(initialState.status.available, true)
  assert.deepEqual(initialState.indexes, {})

  // Engine API absolute paths are always canonical forward-slash form.
  const toCanonicalEnginePath = (p: string) => path.normalize(p).replace(/\\/g, '/')
  const expectedRepo = toCanonicalEnginePath(projectRoot)
  const expectedDb = toCanonicalEnginePath(path.join(userDataRoot, 'engine', `${projectId}.sqlite`))

  const indexResult = await electronAPI.indexProject(projectId)
  assert.equal(indexResult.ok, true)
  assert.equal(indexResult.repo, expectedRepo)
  assert.equal(indexResult.db, expectedDb)
  assert.equal(indexResult.filesIndexed, 2)
  assert.ok(!indexResult.repo.includes('\\'), 'repo must not use backslashes')
  assert.ok(!indexResult.db.includes('\\'), 'db must not use backslashes')

  if (process.platform === 'win32') {
    assert.match(indexResult.repo, /^[A-Za-z]:\//)
    assert.match(indexResult.db, /^[A-Za-z]:\//)
    assert.notEqual(indexResult.repo, projectRoot, 'Windows native path must differ from canonical form')
  }

  const indexedState = await electronAPI.getEngineState()
  assert.equal(indexedState.indexes[projectId].fileCount, 2)
  assert.equal(indexedState.indexes[projectId].dbPath, expectedDb)
  assert.ok(!indexedState.indexes[projectId].dbPath.includes('\\'))

  const searchResult = await electronAPI.searchProjectContent(projectId, 'needle', { regex: true, limit: 10 })
  assert.equal(searchResult.ok, true)
  assert.ok(searchResult.results.length >= 1)
  assert.equal(searchResult.results[0].path, 'src/app.ts')
  assert.ok(!searchResult.results[0].path.includes('\\'), 'search paths stay project-relative with /')

  const statsResult = await electronAPI.getProjectStats(projectId)
  assert.equal(statsResult.ok, true)
  assert.equal(statsResult.stats.totalFiles, 2)
  assert.equal(statsResult.db, expectedDb)
  assert.ok(!statsResult.db.includes('\\'))
})
