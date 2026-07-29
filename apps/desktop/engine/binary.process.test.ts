import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
    isPackaged: false,
  },
}))

vi.mock('./runtime', () => ({
  resolveEngineBinaryPath: () => 'C:\\nonexistent\\engine-missing.js',
  getEngineDbPathFromUserData: () => 'C:\\tmp\\db.sqlite',
  buildEngineIndexArgs: () => ['index'],
  buildEngineSearchArgs: () => ['search'],
  buildEngineStatsArgs: () => ['stats'],
  buildEngineGitArgs: () => ['git'],
}))

describe('runEngineCommand process boundary', () => {
  it('fails loudly when the engine binary cannot be spawned', async () => {
    // resourcesPath may be undefined outside Electron; binary should still reject.
    const { runEngineCommand } = await import('./binary')
    await assert.rejects(() => runEngineCommand(['--version'], { timeoutMs: 5_000 }))
  })
})
