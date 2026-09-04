import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TRAY_CLOSE_HINT_FLAG = 'tray-close-hint-shown'

export function shouldHideToTray(options: {
  isQuitting: boolean
  trayEnabled: boolean
  platform: NodeJS.Platform
}): boolean {
  if (options.isQuitting) return false
  if (!options.trayEnabled) return false
  if (options.platform === 'darwin') return false
  return options.platform === 'win32' || options.platform === 'linux'
}

export function shouldQuitWhenAllWindowsClosed(options: {
  trayEnabled: boolean
  platform: NodeJS.Platform
}): boolean {
  if (options.platform === 'darwin') return false
  return !options.trayEnabled
}

export async function maybeShowTrayCloseHint(options: {
  userDataPath: string
  showNotification: (title: string, body: string) => void
}): Promise<boolean> {
  const flagPath = path.join(options.userDataPath, TRAY_CLOSE_HINT_FLAG)

  try {
    await access(flagPath)
    return false
  } catch {
    // Flag is absent; show the one-time hint.
  }

  options.showNotification(
    'DevDesk is still running',
    'DevDesk was minimized to the system tray. Use Quit on the tray icon to exit completely.'
  )

  try {
    await writeFile(flagPath, '1')
  } catch {
    // Best-effort persist; the hint was already shown.
  }

  return true
}
