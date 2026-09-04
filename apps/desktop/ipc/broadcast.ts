import { BrowserWindow } from 'electron'

export function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    const contents = window.webContents
    if (!contents || contents.isDestroyed()) continue
    contents.send(channel, payload)
  }
}
