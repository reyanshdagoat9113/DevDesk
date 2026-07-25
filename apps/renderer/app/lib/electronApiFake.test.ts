import { describe, expect, it } from 'vitest'
import { createElectronApiFake, installElectronApiFake } from '../../test/createElectronApiFake'

describe('createElectronApiFake', () => {
  it('rejects unstubbed methods by default', async () => {
    const api = createElectronApiFake()
    await expect(api.getProjects()).rejects.toThrow(/not stubbed/)
  })

  it('captures and unsubscribes event handlers', () => {
    const api = createElectronApiFake()
    const seen: unknown[] = []
    const off = api.onRunOutput((payload) => {
      seen.push(payload)
    })
    api.__emit('runs:output', { runId: '1', chunk: 'hi' })
    expect(seen).toEqual([{ runId: '1', chunk: 'hi' }])
    off()
    api.__emit('runs:output', { runId: '1', chunk: 'bye' })
    expect(seen).toHaveLength(1)
  })

  it('installs onto window.electronAPI', async () => {
    const api = installElectronApiFake({
      getProjects: async () => [],
    })
    expect(window.electronAPI).toBe(api)
    await expect(window.electronAPI.getProjects()).resolves.toEqual([])
  })
})
