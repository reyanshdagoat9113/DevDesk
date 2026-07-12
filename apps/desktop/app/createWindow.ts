import { BrowserWindow, Menu } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../../build/icon.png'),
    path.join(process.resourcesPath ?? '', 'build', 'icon.png'),
  ]

  return candidates.find((candidate) => candidate && fs.existsSync(candidate))
}

export function createMainWindow(isDev: boolean): BrowserWindow {
  const iconPath = resolveWindowIcon()

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#09090b',
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
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
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levelLabel = ['debug', 'info', 'warn', 'error'][level] ?? `level-${level}`
      console.log(`[renderer:${levelLabel}] ${message}${sourceId ? ` (${sourceId}:${line})` : ''}`)
    })

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`)
    })

    mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error(`[renderer:preload-error] ${preloadPath}: ${error}`)
    })

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer:process-gone] reason=${details.reason} exitCode=${details.exitCode}`)
    })

    mainWindow.on('unresponsive', () => {
      console.error('[renderer:unresponsive] Main window became unresponsive.')
    })

    mainWindow.loadURL('http://127.0.0.1:5180')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  return mainWindow
}
