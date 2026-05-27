import path from 'node:path'

import { app } from 'electron'

import type {
  AppPreferences,
  CommandTriggerEvent,
  DataStore,
} from '../model'
import { DATA_VERSION } from '../model'

export const STORE_FILENAME = 'devdesk-store.json'
export const DB_FILENAME = 'devdesk.db'
export const SQL_DEBUG = process.env.DEVDESK_SQL_DEBUG === '1'
export const SQL_SLOW_MS = Number.parseInt(process.env.DEVDESK_SQL_SLOW_MS ?? '20', 10)

export const VALID_PROJECT_TYPES = new Set(['node', 'python', 'rust', 'go', 'unknown'])
export const VALID_TRIGGER_EVENTS = new Set<CommandTriggerEvent>(['onProjectOpen', 'afterContainerStart', 'onStartup'])

export function parseBoolean(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return Boolean(value)
}

export const createDefaultPreferences = (): AppPreferences => {
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

export const createDefaultStore = (): DataStore => ({
  version: DATA_VERSION,
  projects: [],
  commands: [],
  chains: [],
  triggers: [],
  runHistory: [],
  notes: {},
  preferences: createDefaultPreferences(),
  bugReports: [],
})

export function getUserDataDir(): string {
  if (!app.isReady()) {
    throw new Error('App not ready: cannot resolve userData path yet.')
  }
  return app.getPath('userData')
}

export function getStorePath(): string {
  return path.join(getUserDataDir(), STORE_FILENAME)
}

export function getDbPath(): string {
  const configuredName = process.env.DEVDESK_DB_FILENAME?.trim()
  const fileName = configuredName || DB_FILENAME
  return path.join(getUserDataDir(), fileName)
}
