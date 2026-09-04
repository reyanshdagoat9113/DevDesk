export type SingleInstanceApp = {
  requestSingleInstanceLock: () => boolean
  quit: () => void
  on: (event: 'second-instance', listener: (...args: unknown[]) => void) => unknown
}

export type FocusableWindow = {
  isDestroyed: () => boolean
  isMinimized: () => boolean
  isVisible: () => boolean
  restore: () => void
  show: () => void
  focus: () => void
}

export function acquireSingleInstanceLock(
  electronApp: SingleInstanceApp,
  onSecondInstance: () => void,
): boolean {
  if (!electronApp.requestSingleInstanceLock()) {
    electronApp.quit()
    return false
  }

  electronApp.on('second-instance', onSecondInstance)
  return true
}

export function focusExistingWindow(windows: FocusableWindow[]): boolean {
  const window = windows.find((candidate) => !candidate.isDestroyed())
  if (!window) {
    return false
  }

  if (window.isMinimized()) {
    window.restore()
  }

  // Close-to-tray hides the window; a second launch must reveal it.
  if (!window.isVisible()) {
    window.show()
  }

  window.focus()
  return true
}
