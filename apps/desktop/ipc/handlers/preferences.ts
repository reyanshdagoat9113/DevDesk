import { app, ipcMain } from 'electron'
import {
  getPreferencesFromStore,
  updatePreferencesInStore,
} from '../../data/store'
import type { AppPreferences } from '../../data/model'

/** Domain registrar: preferences channels only. */
export function registerPreferenceHandlers(): void {
  ipcMain.handle('preferences:get', async () => {
    return getPreferencesFromStore()
  })

  ipcMain.handle('preferences:update', async (_event, updates: Partial<AppPreferences>) => {
    await updatePreferencesInStore(updates)
    app.emit('preferences:updated')
    return { success: true }
  })
}
