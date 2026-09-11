import { shell } from 'electron'
import { IpcChannels, isSafeExternalUrl } from '@devdesk/ipc-contracts'
import { assertSafeExternalUrl, handleTrusted } from '../trustedIpc'

/** Domain registrar: shell / external URL channels. */
export function registerShellHandlers(): void {
  handleTrusted(IpcChannels.ShellOpenExternal, async (_event, url: string) => {
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
