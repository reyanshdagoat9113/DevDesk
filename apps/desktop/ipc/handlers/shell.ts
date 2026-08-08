import { ipcMain, shell } from 'electron'
import { IpcChannels, isSafeExternalUrl } from '@devdesk/ipc-contracts'
import { assertSafeExternalUrl, assertTrustedSender } from '../trustedIpc'

/** Domain registrar: shell / external URL channels. */
export function registerShellHandlers(): void {
  ipcMain.handle(IpcChannels.ShellOpenExternal, async (event, url: string) => {
    assertTrustedSender(event)
    if (!url?.trim()) {
      return { success: false }
    }
    if (!isSafeExternalUrl(url)) {
      return { success: false, error: 'External URL scheme is not allowed.' }
    }
    await shell.openExternal(assertSafeExternalUrl(url))
    return { success: true }
  })
}
