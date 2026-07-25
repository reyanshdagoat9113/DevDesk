import assert from 'node:assert/strict'
import os from 'node:os'
import { beforeEach, describe, it, vi } from 'vitest'

type ExitHandler = (event: { exitCode: number; signal?: number }) => void

type FakePty = {
  onData: (cb: (data: string) => void) => void
  onExit: (cb: ExitHandler) => void
  write: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  pid: number
  emitData: (data: string) => void
  emitExit: (exitCode: number) => void
}

const spawned: FakePty[] = []

function createFakePty(): FakePty {
  let dataHandler: ((data: string) => void) | null = null
  let exitHandler: ExitHandler | null = null

  const fake: FakePty = {
    onData: (cb) => {
      dataHandler = cb
    },
    onExit: (cb) => {
      exitHandler = cb
    },
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 1234,
    emitData: (data) => dataHandler?.(data),
    emitExit: (exitCode) => exitHandler?.({ exitCode }),
  }

  return fake
}

vi.mock('node-pty', () => ({
  spawn: () => {
    const fake = createFakePty()
    spawned.push(fake)
    return fake
  },
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: {
    isReady: () => true,
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../data/store', () => ({
  getPreferencesFromStore: async () => ({ terminal: { id: 'powershell' } }),
  getProjectById: async () => null,
}))

const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

describe('TerminalManager lifecycle', () => {
  beforeEach(() => {
    spawned.length = 0
  })

  it('coalesces output, finalizes exit once, and drops the session', async () => {
    vi.useFakeTimers()
    try {
      const { TerminalManager } = await import('./terminalManager')
      const events: Array<{ channel: string; payload: unknown }> = []
      const manager = new TerminalManager((channel, payload) => events.push({ channel, payload }))

      const session = await manager.create({ cwd: os.tmpdir(), shell })
      assert.equal(manager.getSession(session.id)?.id, session.id)

      const pty = spawned[0]
      pty.emitData('a')
      pty.emitData('b')
      assert.equal(events.length, 0, 'output must be buffered, not broadcast per chunk')

      vi.advanceTimersByTime(10)
      const dataEvents = events.filter((e) => e.channel === 'terminal:data')
      assert.equal(dataEvents.length, 1, 'buffered output must flush as one event')
      assert.deepEqual(dataEvents[0].payload, { terminalId: session.id, data: 'ab' })

      pty.emitExit(3)
      pty.emitExit(3)
      const exitEvents = events.filter((e) => e.channel === 'terminal:exit')
      assert.equal(exitEvents.length, 2, 'pty reports exit; manager forwards each report')
      assert.equal(manager.getSession(session.id), undefined, 'session must be dropped on exit')
      assert.equal(manager.get(session.id), undefined)
    } finally {
      vi.useRealTimers()
    }
  })

  it('closeAll kills every live session exactly once and is idempotent', async () => {
    const { TerminalManager } = await import('./terminalManager')
    const manager = new TerminalManager(() => {})

    const first = await manager.create({ cwd: os.tmpdir(), shell })
    const second = await manager.create({ cwd: os.tmpdir(), shell })
    assert.equal(spawned.length, 2)

    manager.closeAll()
    assert.equal(spawned[0].kill.mock.calls.length, 1)
    assert.equal(spawned[1].kill.mock.calls.length, 1)

    // Sessions only clear once the pty reports exit; closeAll must not double-kill.
    manager.closeAll()
    assert.equal(spawned[0].kill.mock.calls.length, 2, 'kill is re-sent while the pty is still live')

    spawned[0].emitExit(0)
    spawned[1].emitExit(0)
    manager.closeAll()
    assert.equal(spawned[0].kill.mock.calls.length, 2, 'exited sessions are not killed again')
    assert.equal(manager.getSession(first.id), undefined)
    assert.equal(manager.getSession(second.id), undefined)
  })

  it('write and resize ignore unknown terminal ids', async () => {
    const { TerminalManager } = await import('./terminalManager')
    const manager = new TerminalManager(() => {})

    manager.write('missing', 'x')
    manager.resize('missing', 10, 10)

    const session = await manager.create({ cwd: os.tmpdir(), shell })
    manager.write(session.id, 'ls')
    manager.resize(session.id, 120, 40)

    assert.deepEqual(spawned[0].write.mock.calls, [['ls']])
    assert.deepEqual(spawned[0].resize.mock.calls, [[120, 40]])
    assert.equal(manager.getSession(session.id)?.cols, 120)
    assert.equal(manager.getSession(session.id)?.rows, 40)
  })
})
