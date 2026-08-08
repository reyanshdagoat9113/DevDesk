import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { describe, it, vi } from 'vitest'

const { utilityFork } = vi.hoisted(() => ({
  utilityFork: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
    isPackaged: false,
  },
  utilityProcess: {
    fork: utilityFork,
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

  it('uses an Electron utility process and captures its JSON stdout', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    })
    utilityFork.mockReturnValueOnce(child)

    const { runEngineCommand } = await import('./binary')
    const result = runEngineCommand(['--version'])

    child.stdout.emit('data', Buffer.from('0.1.0\n'))
    child.emit('exit', 0)

    await assert.doesNotReject(result)
    assert.equal(await result, '0.1.0\n')
    assert.deepEqual(utilityFork.mock.calls[0]?.slice(0, 2), [
      path.join(path.dirname('C:\\nonexistent\\engine-missing.js'), 'runner.js'),
      ['--version'],
    ])
    assert.equal(utilityFork.mock.calls[0]?.[2]?.stdio, 'pipe')
  })
})
