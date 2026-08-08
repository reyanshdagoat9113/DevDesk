import { ipcMain } from 'electron'
import {
  clearRunHistoryInStore,
  getRunHistoryOutputById,
  listRecentRunHistory,
  listRunHistory,
  removeRunHistoryEntry,
} from '../../data/store'
import { runningCommands } from '../runtimeState'

/** Domain registrar: run-history channels only. */
export function registerHistoryHandlers(): void {
  ipcMain.handle('history:get', async () => {
    return listRunHistory()
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
      return running.output
    }
    return getRunHistoryOutputById(_runId)
  })
}
