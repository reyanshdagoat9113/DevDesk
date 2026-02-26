import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './app/createWindow'
import { reconcileRunHistory } from './data/store'
import { registerIpcHandlers } from './ipc/registerIpc'

// Determine if we're in development mode
// In production builds or when NODE_ENV=production, use production mode
// app.isPackaged is only true for actual packaged apps (electron-builder)
function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && !app.isPackaged
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
