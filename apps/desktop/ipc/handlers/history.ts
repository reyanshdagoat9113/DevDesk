import { ipcMain } from 'electron'
import {
  clearRunHistoryInStore,
  countRunHistory,
  getRunHistoryOutputById,
  listRecentRunHistory,
  listRunHistory,
  removeRunHistoryEntry,
} from '../../data/store'
import { serializeRunOutput } from '../../system/runOutputBuffer'
import { runningCommands } from '../runtimeState'

const DEFAULT_HISTORY_LIMIT = 200
const MAX_HISTORY_LIMIT = 500

function sanitizeHistoryPageOptions(options?: { limit?: number; offset?: number }): {
  limit: number
  offset: number
} {
  const rawLimit = typeof options?.limit === 'number' && Number.isFinite(options.limit)
    ? Math.trunc(options.limit)
    : DEFAULT_HISTORY_LIMIT
  const rawOffset = typeof options?.offset === 'number' && Number.isFinite(options.offset)
    ? Math.trunc(options.offset)
    : 0
  return {
    limit: Math.min(Math.max(1, rawLimit), MAX_HISTORY_LIMIT),
    offset: Math.max(0, rawOffset),
  }
}

/** Domain registrar: run-history channels only. */
export function registerHistoryHandlers(): void {
  ipcMain.handle('history:get', async (_event, options?: { limit?: number; offset?: number }) => {
    const { limit, offset } = sanitizeHistoryPageOptions(options)
    const [entries, total] = await Promise.all([
      listRunHistory({ limit, offset }),
      countRunHistory(),
    ])
    return { entries, total, limit, offset }
  })

  ipcMain.handle('history:listRecent', async (_event, limit?: number) => {
    const cap = Math.min(Math.max(1, limit ?? 20), 100)
    return listRecentRunHistory(cap)
  })

  ipcMain.handle('history:clear', async () => {
    await clearRunHistoryInStore()
    return { success: true }
  })

  ipcMain.handle('history:remove', async (_event, runId: string) => {
    const id = runId?.trim()
    if (!id) {
      return { success: false }
    }

    if (runningCommands.has(id)) {
      throw new Error('Cannot remove a running command.')
    }

    await removeRunHistoryEntry(id)
    return { success: true }
  })

  ipcMain.handle('history:output', async (_event, _runId: string) => {
    const running = runningCommands.get(_runId)
    if (running) {
      return serializeRunOutput(running.output)
    }
    return getRunHistoryOutputById(_runId)
  })
}
