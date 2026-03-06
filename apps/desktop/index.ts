import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './app/createWindow'
import { reconcileRunHistory } from './data/store'
import { registerIpcHandlers } from './ipc/registerIpc'

// Determine if we're in development mode
// app.isPackaged is false for local "electron ." runs and true for packaged builds.
// Relying on NODE_ENV here is fragile on Windows because npm scripts don't set it
// consistently without cross-env.
function isDevMode(): boolean {
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
