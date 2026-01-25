import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './app/createWindow'
import { registerIpcHandlers } from './ipc/registerIpc'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Register IPC handlers before app is ready
registerIpcHandlers()

app.whenReady().then(() => {
  createMainWindow(isDev)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(isDev)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
