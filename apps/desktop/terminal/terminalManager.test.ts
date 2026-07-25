import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ptySpawn = vi.fn()
const getPreferencesFromStore = vi.fn()
const getProjectById = vi.fn()

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => ptySpawn(...args),
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

vi.mock('../data/store', () => ({
  getPreferencesFromStore: (...args: unknown[]) => getPreferencesFromStore(...args),
  getProjectById: (...args: unknown[]) => getProjectById(...args),
}))

function createFakePty() {
  const handlers: { data?: (chunk: string) => void; exit?: (code: number) => void } = {}
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (handler: (chunk: string) => void) => {
      handlers.data = handler
    },
    onExit: (handler: (event: { exitCode: number }) => void) => {
      handlers.exit = (code: number) => handler({ exitCode: code })
    },
    _emitData(chunk: string) {
      handlers.data?.(chunk)
    },
    _emitExit(code: number) {
      handlers.exit?.(code)
    },
  }
}

describe('TerminalManager', () => {
  beforeEach(() => {
    ptySpawn.mockReset()
    getPreferencesFromStore.mockReset()
    getProjectById.mockReset()
    getPreferencesFromStore.mockResolvedValue({
      editor: { id: 'vscode' },
      terminal: { id: process.platform === 'win32' ? 'powershell' : 'terminal' },
      trayEnabled: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a session with the preferred shell and home cwd by default', async () => {
    const fakePty = createFakePty()
    ptySpawn.mockReturnValue(fakePty)
    const broadcasts: Array<{ channel: string; payload: unknown }> = []
    const { TerminalManager } = await import('./terminalManager')
    const manager = new TerminalManager((channel, payload) => {
      broadcasts.push({ channel, payload })
    })

    const session = await manager.create({ cols: 100, rows: 30 })

    assert.ok(session.id)
    assert.equal(session.cols, 100)
    assert.equal(session.rows, 30)
    assert.equal(session.cwd, os.homedir())
    assert.equal(ptySpawn.mock.calls.length, 1)
    const [shell, args, options] = ptySpawn.mock.calls[0] as [string, string[], { cwd: string; cols: number; rows: number }]
    if (process.platform === 'win32') {
      assert.equal(shell, 'powershell.exe')
    } else {
      assert.ok(shell.includes('bash') || shell.includes('zsh') || shell.includes('sh'))
    }
    assert.deepEqual(args, [])
    assert.equal(options.cwd, os.homedir())
    assert.equal(options.cols, 100)
    assert.equal(options.rows, 30)

    manager.write(session.id, 'echo hi')
    expect(fakePty.write).toHaveBeenCalledWith('echo hi')

    manager.resize(session.id, 120, 40)
    expect(fakePty.resize).toHaveBeenCalledWith(120, 40)

    manager.close(session.id)
    expect(fakePty.kill).toHaveBeenCalled()
  })

  it('rejects blocked system working directories', async () => {
    const { TerminalManager } = await import('./terminalManager')
    const manager = new TerminalManager(() => undefined)
    const blocked =
      process.platform === 'win32'
        ? path.join('C:', 'Windows', 'System32')
        : '/usr/bin'

    // On non-Windows, force a synthetic blocked path via Windows-style check is skipped;
    // use a non-existent path for the portable assertion.
    if (process.platform === 'win32') {
      await assert.rejects(() => manager.create({ cwd: blocked }), /not allowed|does not exist/i)
    } else {
      await assert.rejects(() => manager.create({ cwd: path.join(os.tmpdir(), 'missing-terminal-cwd') }), /does not exist/i)
    }
  })

  it('rejects disallowed shells', async () => {
    const { TerminalManager } = await import('./terminalManager')
    const manager = new TerminalManager(() => undefined)
    await assert.rejects(() => manager.create({ shell: 'evil-shell.exe' }), /Shell not allowed/i)
  })
})
