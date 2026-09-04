import { app, BrowserWindow, Notification } from 'electron'
import { createMainWindow } from './app/createWindow'
import { maybeShowTrayCloseHint, shouldHideToTray, shouldQuitWhenAllWindowsClosed } from './app/closeToTray'
import { acquireSingleInstanceLock, focusExistingWindow } from './app/singleInstance'
import { getPreferencesFromStore, reconcileRunHistory } from './data/store'
import { cleanupOnQuit } from './ipc/quitCleanup'
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
let isQuitting = false
let quitCleanupFinished = false

function bindWindowCloseToTray(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (!shouldHideToTray({
      isQuitting,
      trayEnabled: trayManager?.isEnabled() ?? false,
      platform: process.platform,
    })) {
      return
    }

    event.preventDefault()
    window.hide()
    void maybeShowTrayCloseHint({
      userDataPath: app.getPath('userData'),
      showNotification: (title, body) => {
        if (!Notification.isSupported()) {
          return
        }
        new Notification({ title, body }).show()
      },
    }).catch((error) => {
      console.error('Failed to show tray close hint:', error)
    })
  })
}

function createBoundMainWindow(): BrowserWindow {
  const window = createMainWindow(isDevMode())
  bindWindowCloseToTray(window)
  return window
}

function revealOrCreateMainWindow(): void {
  if (trayManager) {
    trayManager.showWindow()
  }

  if (focusExistingWindow(BrowserWindow.getAllWindows())) {
    return
  }

  const window = createBoundMainWindow()
  trayManager?.setMainWindow(window)
}

const gotLock = acquireSingleInstanceLock(app, () => {
  revealOrCreateMainWindow()
})

if (gotLock) {
  app.whenReady().then(async () => {
    registerIpcHandlers()

    await reconcileRunHistory()

    const mainWindow = createBoundMainWindow()

    trayManager = new TrayManager(mainWindow, { runLastCommand })
    await trayManager.init()

    emitStartupAutomationTriggers()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const newWindow = createBoundMainWindow()
        trayManager?.setMainWindow(newWindow)
      } else {
        trayManager?.showWindow()
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
    if (shouldQuitWhenAllWindowsClosed({
      trayEnabled: trayManager?.isEnabled() ?? false,
      platform: process.platform,
    })) {
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (quitCleanupFinished) {
      return
    }

    event.preventDefault()
    isQuitting = true

    try {
      trayManager?.dispose()
      terminalManager.closeAll()
    } catch (error) {
      console.error('Failed to close all terminals during quit:', error)
    }

    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, 2000)
    })

    void Promise.race([cleanupOnQuit(), timeout]).finally(() => {
      quitCleanupFinished = true
      app.quit()
    })
  })
}
