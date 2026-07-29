import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
  ipcMain: {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      if (handlers.has(channel)) {
        throw new Error(`already registered ${channel}`)
      }
      handlers.set(channel, listener)
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel)
    },
  },
}))

afterEach(async () => {
  const { resetRegisteredIpcChannelsForTests } = await import('./trustedIpc')
  resetRegisteredIpcChannelsForTests()
  handlers.clear()
})

describe('trusted IPC registration', () => {
  it('rejects duplicate channel registration', async () => {
    const { handleTrusted } = await import('./trustedIpc')
    handleTrusted('shell:open-external', async () => ({ ok: true }))
    assert.throws(
      () => handleTrusted('shell:open-external', async () => ({ ok: true })),
      /Duplicate IPC handler/,
    )
  })

  it('rejects untrusted senders', async () => {
    const { handleTrusted, registerTrustedWebContents } = await import('./trustedIpc')
    handleTrusted('shell:open-external', async () => ({ ok: true }))
    const listener = handlers.get('shell:open-external')
    assert.ok(listener)
    await assert.rejects(
      async () => listener({ sender: { id: 999 } }),
      /Untrusted IPC sender/,
    )
    registerTrustedWebContents(42)
    const result = await listener({ sender: { id: 42 } })
    assert.deepEqual(result, { ok: true })
  })
})
