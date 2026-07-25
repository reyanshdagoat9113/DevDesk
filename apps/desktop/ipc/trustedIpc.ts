import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { isSafeExternalUrl, type IpcInvokeChannel } from '@devdesk/ipc-contracts'

const registeredChannels = new Set<string>()

let trustedWebContentsIds = new Set<number>()

export function setTrustedWebContentsIds(ids: Iterable<number>): void {
  trustedWebContentsIds = new Set(ids)
}

export function registerTrustedWebContents(webContentsId: number): void {
  trustedWebContentsIds.add(webContentsId)
}

export function unregisterTrustedWebContents(webContentsId: number): void {
  trustedWebContentsIds.delete(webContentsId)
}

export function syncTrustedWindowsFromBrowserWindows(): void {
  const ids = BrowserWindow.getAllWindows()
    .map((win) => win.webContents?.id)
    .filter((id): id is number => typeof id === 'number')
  setTrustedWebContentsIds(ids)
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderId = event.sender?.id
  if (typeof senderId !== 'number' || !trustedWebContentsIds.has(senderId)) {
    // During early boot before windows are tracked, allow the sole existing window.
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 1 && windows[0].webContents?.id === senderId) {
      trustedWebContentsIds.add(senderId)
      return
    }
    throw new Error('Untrusted IPC sender.')
  }
}

export function assertSafeExternalUrl(url: string): string {
  const trimmed = url?.trim() ?? ''
  if (!isSafeExternalUrl(trimmed)) {
    throw new Error('External URL scheme is not allowed.')
  }
  return trimmed
}

export function handleTrusted(
  channel: IpcInvokeChannel | string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  if (registeredChannels.has(channel)) {
    throw new Error(`Duplicate IPC handler registration for channel: ${channel}`)
  }
  registeredChannels.add(channel)
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    return listener(event, ...args)
  })
}

export function getRegisteredIpcChannels(): string[] {
  return [...registeredChannels].sort()
}

export function resetRegisteredIpcChannelsForTests(): void {
  for (const channel of registeredChannels) {
    ipcMain.removeHandler(channel)
  }
  registeredChannels.clear()
  trustedWebContentsIds.clear()
}
