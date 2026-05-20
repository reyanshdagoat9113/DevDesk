import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './app/createWindow'
import { reconcileRunHistory } from './data/store'
import { emitStartupAutomationTriggers, registerIpcHandlers } from './ipc/registerIpc'
import { terminalManager } from './terminal/terminalManager'

function isDevMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  return !app.isPackaged
}

// Register IPC handlers when app is ready
app.whenReady().then(async () => {
  // Register IPC handlers first
  registerIpcHandlers()
  
  // Reconcile any running commands from previous session
  await reconcileRunHistory()
  
  // Create main window
  createMainWindow(isDevMode())

  emitStartupAutomationTriggers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(isDevMode())
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
    terminalManager.closeAll()
  } catch (error) {
    console.error('Failed to close all terminals during quit:', error)
  }
})
