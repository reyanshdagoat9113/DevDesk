import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './app/createWindow'
import { getPreferencesFromStore, reconcileRunHistory } from './data/store'
import { emitStartupAutomationTriggers, registerIpcHandlers, runLastCommand } from './ipc/registerIpc'
import { terminalManager } from './terminal/terminalManager'
import { TrayManager } from './tray/trayManager'

function isDevMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  return !app.isPackaged
}

let trayManager: TrayManager | null = null

// Register IPC handlers when app is ready
app.whenReady().then(async () => {
  // Register IPC handlers first
  registerIpcHandlers()
  
  // Reconcile any running commands from previous session
  await reconcileRunHistory()
  
  // Create main window
  const mainWindow = createMainWindow(isDevMode())

  // Initialize system tray
  trayManager = new TrayManager(mainWindow, { runLastCommand })
  await trayManager.init()

  emitStartupAutomationTriggers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createMainWindow(isDevMode())
      trayManager?.setMainWindow(newWindow)
    }
  })

  ;(app as NodeJS.EventEmitter).on('preferences:updated', async () => {
    try {
      const prefs = await getPreferencesFromStore()
      await trayManager?.updateEnabled(prefs.trayEnabled)
    } catch {
      // ignore
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  try {
    trayManager?.dispose()
    terminalManager.closeAll()
  } catch (error) {
    console.error('Failed to close all terminals during quit:', error)
  }
})
