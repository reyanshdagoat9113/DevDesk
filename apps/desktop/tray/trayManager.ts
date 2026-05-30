import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { terminalManager } from '../terminal/terminalManager'
import { getPreferencesFromStore } from '../data/store'

// Embedded tray icons to avoid file-path issues in dev vs production.
// Icons generated at build time from apps/desktop/assets.

/** 16x16 colored tray icon (Windows/Linux) */
const TRAY_ICON_16 = nativeImage.createFromBuffer(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVUlEQVR4nGNgGGjAiE3Quunbf1wajtZxoehhJFYjLoOYGCgETOTYjqyehVi/4rKECZ8NMIzPUCYGCgETpQawUBoGLLgMIDZWmPDZiA9QLSFRnBcoBgBIJSg0qVXvTAAAAABJRU5ErkJggg==',
    'base64'
  )
)

/** 32x32 colored tray icon (Windows/Linux @2x) */
const TRAY_ICON_32 = nativeImage.createFromBuffer(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoUlEQVR4nO2Xuw2AMAxEnZMrVspuFOzGSrTQo/wc7FgRuTKy3p2dD4Jo6e8KrYXxuG4p/Ny3Kj9YGEuCwNq8xoG1eY2HEeYlLshZGNV9js/ap1raAGsZv2tag4CcBc3ue+q5FVgaqTTcnFtgJW4t/DJmlQlE4f2e5hpyT1duL6HF9wKjDluOD3IWUotWU0hxISnWNi8G0AxR4gTv/4Il8tYDwdhMPCFHR1EAAAAASUVORK5CYII=',
    'base64'
  )
)

/** 16x16 template tray icon (macOS) */
const TRAY_ICON_TEMPLATE_16 = nativeImage.createFromBuffer(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAATklEQVR4nGNgGGjAiEP8P7F6GEnQiNUgJgYKAROZtsPVs5AYPhiWMBGwAYZxGsrEQCFgotQAFkrDgAWPAf9J9QIjMRrQ1VMcBhTnBYoBAPMxCxtSJH+qAAAAAElFTkSuQmCC',
    'base64'
  )
)

/** 32x32 template tray icon (macOS @2x) */
const TRAY_ICON_TEMPLATE_32 = nativeImage.createFromBuffer(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkUlEQVR4nO2XSw7AIAhEccL9r2z3tVIwfGrqLJvJG8Cqkejo72oGb4/gt6BgdQ4SwkUOEsJFHpLCp1xQsZDY/SOfFyHS7jE1wI7Bd4+qEFCxEHRqqv1sAHbH4vZcghCxwbs8Zq8JdCN7j23Ii12VnYTu9wWyfrYZH1QsTL5HTWHgwmL2Dn8rwLOI9tl3wRFV6wLneBM8CrjhSQAAAABJRU5ErkJggg==',
    'base64'
  )
)

function getTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    const icon = TRAY_ICON_TEMPLATE_16
    icon.setTemplateImage(true)
    // macOS automatically scales @2x when a matching file is present,
    // but since we are using nativeImage from buffers we attach the
    // higher-resolution variant manually.
    icon.addRepresentation({
      scaleFactor: 2,
      buffer: TRAY_ICON_TEMPLATE_32.toPNG(),
    })
    return icon
  }

  const icon = TRAY_ICON_16
  icon.addRepresentation({
    scaleFactor: 2,
    buffer: TRAY_ICON_32.toPNG(),
  })
  return icon
}

function broadcastToRenderers(channel: string, payload: unknown) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}

type TrayActionCallbacks = {
  runLastCommand: () => Promise<{ success: boolean; error?: string }>
}

export class TrayManager {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private callbacks: TrayActionCallbacks
  private enabled = true

  constructor(mainWindow: BrowserWindow, callbacks: TrayActionCallbacks) {
    this.mainWindow = mainWindow
    this.callbacks = callbacks
  }

  async init() {
    try {
      const prefs = await getPreferencesFromStore()
      this.enabled = prefs.trayEnabled
    } catch {
      this.enabled = true
    }

    if (this.enabled) {
      this.createTray()
    }
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async updateEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) {
      this.createTray()
    } else {
      this.destroyTray()
    }
  }

  private createTray() {
    if (this.tray) return

    const icon = getTrayIcon()
    this.tray = new Tray(icon)
    this.tray.setToolTip('DevDesk')
    this.tray.setContextMenu(this.buildContextMenu())

    // Left-click toggles window visibility
    this.tray.on('click', () => {
      this.toggleWindow()
    })
  }

  private destroyTray() {
    if (!this.tray) return
    this.tray.destroy()
    this.tray = null
  }

  private buildContextMenu(): Electron.Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Show DevDesk',
        click: () => this.showWindow(),
      },
      { type: 'separator' },
      {
        label: 'New Terminal',
        click: async () => {
          try {
            const session = await terminalManager.create({ cols: 80, rows: 24 })
            broadcastToRenderers('tray:terminal-created', {
              terminalId: session.id,
              projectId: session.projectId,
            })
            this.showWindow()
          } catch (error) {
            console.error('Tray: failed to create terminal:', error)
          }
        },
      },
      {
        label: 'Run Last Command',
        click: async () => {
          try {
            const result = await this.callbacks.runLastCommand()
            if (!result.success) {
              console.error('Tray: run last command failed:', result.error)
            } else {
              this.showWindow()
            }
          } catch (error) {
            console.error('Tray: run last command error:', error)
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        },
      },
    ])
  }

  private showWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        this.mainWindow = windows[0]
      } else {
        return
      }
    }

    if (this.mainWindow.isVisible()) {
      this.mainWindow.focus()
    } else {
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  private toggleWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        this.mainWindow = windows[0]
      } else {
        return
      }
    }

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide()
    } else {
      this.showWindow()
    }
  }

  dispose() {
    this.destroyTray()
    this.mainWindow = null
  }
}
