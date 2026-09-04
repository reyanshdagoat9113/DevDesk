import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'

const getAllWindows = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => getAllWindows(),
  },
}))

const { broadcast } = await import('./broadcast')

describe('broadcast', () => {
  afterEach(() => {
    getAllWindows.mockReset()
  })

  it('skips destroyed windows and destroyed webContents', () => {
    const sendDestroyedWindow = vi.fn()
    const sendDestroyedContents = vi.fn()
    const sendLive = vi.fn()

    getAllWindows.mockReturnValue([
      {
        isDestroyed: () => true,
        webContents: { isDestroyed: () => false, send: sendDestroyedWindow },
      },
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => true, send: sendDestroyedContents },
      },
      {
        isDestroyed: () => false,
        webContents: null,
      },
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send: sendLive },
      },
    ])

    broadcast('test:channel', { ok: true })

    assert.equal(sendDestroyedWindow.mock.calls.length, 0)
    assert.equal(sendDestroyedContents.mock.calls.length, 0)
    assert.equal(sendLive.mock.calls.length, 1)
    assert.deepEqual(sendLive.mock.calls[0], ['test:channel', { ok: true }])
  })

  it('sends to live windows only', () => {
    const sendA = vi.fn()
    const sendB = vi.fn()
    const sendDead = vi.fn()

    getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send: sendA },
      },
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send: sendB },
      },
      {
        isDestroyed: () => true,
        webContents: { isDestroyed: () => false, send: sendDead },
      },
    ])

    broadcast('docker:logs:data', { chunk: 'x' })

    assert.equal(sendA.mock.calls.length, 1)
    assert.equal(sendB.mock.calls.length, 1)
    assert.equal(sendDead.mock.calls.length, 0)
    assert.deepEqual(sendA.mock.calls[0], ['docker:logs:data', { chunk: 'x' }])
    assert.deepEqual(sendB.mock.calls[0], ['docker:logs:data', { chunk: 'x' }])
  })
})
