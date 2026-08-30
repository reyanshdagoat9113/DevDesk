import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { installElectronApiFake } from '../test/createElectronApiFake'
import App from './App'

const preferences = {
  editor: { id: 'vscode' },
  terminal: { id: 'windows-terminal' },
  trayEnabled: true,
}

const engineState = {
  status: { available: true, version: '0.1.0' },
  indexes: {},
  searchSessions: {},
}

function bootstrapStubs(overrides: Record<string, unknown> = {}) {
  return {
    getProjects: vi.fn(async () => []),
    getCommands: vi.fn(async () => []),
    getChains: vi.fn(async () => []),
    getTriggers: vi.fn(async () => []),
    getPendingTriggerConfirmations: vi.fn(async () => []),
    getRunHistory: vi.fn(async () => ({ entries: [], total: 0, limit: 200, offset: 0 })),
    getPreferences: vi.fn(async () => preferences),
    getEngineState: vi.fn(async () => engineState),
    getContainers: vi.fn(async () => []),
    listWslDistros: vi.fn(async () => []),
    ...overrides,
  }
}

describe('App bootstrap', () => {
  it('loads every bootstrap source in parallel and clears the loading state', async () => {
    const stubs = bootstrapStubs()
    installElectronApiFake(stubs as never)

    render(<App />)

    await waitFor(() => {
      expect(stubs.getProjects).toHaveBeenCalledTimes(1)
    })
    for (const call of [
      stubs.getCommands,
      stubs.getChains,
      stubs.getTriggers,
      stubs.getPendingTriggerConfirmations,
      stubs.getRunHistory,
      stubs.getPreferences,
      stubs.getEngineState,
    ]) {
      expect(call).toHaveBeenCalledTimes(1)
    }
  })

  it('surfaces a partial bootstrap failure without discarding the sources that succeeded', async () => {
    const stubs = bootstrapStubs({
      getProjects: vi.fn(async () => {
        throw new Error('projects backend unavailable')
      }),
      getCommands: vi.fn(async () => [
        {
          id: 'cmd-1',
          name: 'Install deps',
          command: 'npm install',
          projectId: null,
          isPinned: false,
          createdAt: new Date().toISOString(),
        },
      ]),
    })
    installElectronApiFake(stubs as never)

    render(<App />)

    // Failure of one source is reported...
    const error = await screen.findByText(/projects backend unavailable/i)
    expect(error).toBeTruthy()
    // ...while the remaining sources still resolved.
    await waitFor(() => {
      expect(stubs.getCommands).toHaveBeenCalledTimes(1)
      expect(stubs.getPreferences).toHaveBeenCalledTimes(1)
    })
  })

  it('removes every event subscription on unmount', async () => {
    const api = installElectronApiFake(bootstrapStubs() as never)
    const { unmount } = render(<App />)

    await waitFor(() => {
      expect((api.__handlers['runs:status']?.size ?? 0) > 0).toBe(true)
    })

    const subscribed = Object.entries(api.__handlers)
      .filter(([, handlers]) => handlers.size > 0)
      .map(([event]) => event)
    expect(subscribed.length).toBeGreaterThan(0)

    unmount()

    for (const event of subscribed) {
      expect(api.__handlers[event]?.size ?? 0).toBe(0)
    }
  })
})
