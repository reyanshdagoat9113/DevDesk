import { app } from 'electron'
import {
  getPreferencesFromStore,
  updatePreferencesInStore,
} from '../../data/store'
import type { AppPreferences } from '../../data/model'
import { handleTrusted } from '../trustedIpc'

/** Domain registrar: preferences channels only. */
export function registerPreferenceHandlers(): void {
  handleTrusted('preferences:get', async () => {
    return getPreferencesFromStore()
  })

  handleTrusted('preferences:update', async (_event, updates: Partial<AppPreferences>) => {
    await updatePreferencesInStore(updates)
    app.emit('preferences:updated')
    return { success: true }
  })
}
