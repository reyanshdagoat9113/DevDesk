import { BrowserWindow, Menu } from 'electron'
import path from 'node:path'

export function createMainWindow(isDev: boolean): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    mainWindow.setMenuBarVisibility(false)
    mainWindow.removeMenu()
  }

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5180')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  return mainWindow
}
