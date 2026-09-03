import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

import { quoteCmdArgIfNeeded, spawnDetached, spawnDetachedWithShellFallback, spawnShellDetached } from './detachedSpawn'

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform })
}

function fakeChild(behavior: { error?: Error } = {}) {
  const child = new EventEmitter()
  Object.assign(child, { unref: vi.fn() })
  queueMicrotask(() => {
    if (behavior.error) {
      child.emit('error', behavior.error)
    } else {
      child.emit('spawn')
    }
  })
  return child
}

afterEach(() => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor)
  }
})

describe('spawnDetachedWithShellFallback', () => {
  it('resolves on first successful spawn without retrying', async () => {
    setPlatform('win32')
    spawnMock.mockImplementation(() => fakeChild())

    const result = await spawnDetachedWithShellFallback('wt', ['-d', 'C:\\Projects'])

    expect(result).toEqual({ success: true })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock.mock.calls[0]?.[0]).toBe('wt')
    expect(spawnMock.mock.calls[0]?.[1]).toEqual(['-d', 'C:\\Projects'])
    expect(spawnMock.mock.calls[0]?.[2]).toEqual({
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    })
  })

  it('retries once with shell:true and quoted spaced args after ENOENT on win32', async () => {
    setPlatform('win32')
    spawnMock
      .mockImplementationOnce(() => fakeChild({ error: new Error('spawn wt ENOENT') }))
      .mockImplementationOnce(() => fakeChild())

    const result = await spawnDetachedWithShellFallback('wt', ['-d', 'C:\\My Projects\\app'])

    expect(result).toEqual({ success: true })
    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1]?.[1]).toEqual(['-d', '"C:\\My Projects\\app"'])
    expect(spawnMock.mock.calls[1]?.[2]).toMatchObject({ shell: true, detached: true, stdio: 'ignore' })
  })

  it('quotes only unsafe tokens on retry while bare flags stay untouched', async () => {
    setPlatform('win32')
    spawnMock
      .mockImplementationOnce(() => fakeChild({ error: new Error('spawn code ENOENT') }))
      .mockImplementationOnce(() => fakeChild())

    await spawnDetachedWithShellFallback('code', ['--goto', 'C:\\My Projects\\src\\app.ts:12:3', 'extra arg'])

    expect(spawnMock.mock.calls[1]?.[1]).toEqual(['--goto', '"C:\\My Projects\\src\\app.ts:12:3"', '"extra arg"'])
  })

  it('retries after the cmd.exe "not recognized" message on win32', async () => {
    setPlatform('win32')
    spawnMock
      .mockImplementationOnce(
        () => fakeChild({ error: new Error('wt : The term is not recognized as an internal or external command') }),
      )
      .mockImplementationOnce(() => fakeChild())

    const result = await spawnDetachedWithShellFallback('wt', ['ok'])

    expect(result).toEqual({ success: true })
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('keeps caller-provided options on the shell retry', async () => {
    setPlatform('win32')
    spawnMock
      .mockImplementationOnce(() => fakeChild({ error: new Error('spawn wt ENOENT') }))
      .mockImplementationOnce(() => fakeChild())

    await spawnDetachedWithShellFallback('wt', ['C:\\My Projects\\app'], { windowsHide: false })

    expect(spawnMock.mock.calls[1]?.[2]).toEqual({
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: true,
    })
  })

  it('does not retry on non-win32 platforms', async () => {
    setPlatform('linux')
    spawnMock.mockImplementation(() => fakeChild({ error: new Error('spawn code ENOENT') }))

    const result = await spawnDetachedWithShellFallback('code', ['C:\\My Projects\\app'])

    expect(result).toEqual({ success: false, error: 'spawn code ENOENT' })
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry when options.shell is already set', async () => {
    setPlatform('win32')
    spawnMock.mockImplementation(() => fakeChild({ error: new Error('spawn wt ENOENT') }))

    const result = await spawnDetachedWithShellFallback('wt', ['C:\\My Projects\\app'], { shell: true })

    expect(result).toEqual({ success: false, error: 'spawn wt ENOENT' })
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry on non-ENOENT errors', async () => {
    setPlatform('win32')
    spawnMock.mockImplementation(() => fakeChild({ error: new Error('spawn code EACCES') }))

    const result = await spawnDetachedWithShellFallback('code', ['path'])

    expect(result).toEqual({ success: false, error: 'spawn code EACCES' })
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})

describe('spawnDetached', () => {
  it('reports spawn errors and never rejects', async () => {
    spawnMock.mockImplementation(() => fakeChild({ error: new Error('boom') }))

    const result = await spawnDetached('missing-app', [])

    expect(result).toEqual({ success: false, error: 'boom' })
  })
})

describe('spawnShellDetached', () => {
  it('spawns with shell:true and no args, supporting an optional options parameter', async () => {
    spawnMock.mockImplementation(() => fakeChild())

    const result = await spawnShellDetached('code "C:\\My Projects"')

    expect(result).toEqual({ success: true })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock.mock.calls[0]?.[0]).toBe('code "C:\\My Projects"')
    expect(spawnMock.mock.calls[0]?.[1]).toEqual({
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: true,
    })
  })
})

describe('quoteCmdArgIfNeeded', () => {
  it.each([
    ['-d', '-d'],
    ['--goto', '--goto'],
    ['file.ts', 'file.ts'],
    ['C:\\My Projects\\app', '"C:\\My Projects\\app"'],
    ['say "hi"', '"say ""hi"""'],
    ['a&b', '"a&b"'],
    ['a|b', '"a|b"'],
    ['(x)', '"(x)"'],
    ['a^b', '"a^b"'],
    ['a!b', '"a!b"'],
    ['a<b>c', '"a<b>c"'],
    ['100%', '"100%"'],
  ])('quotes %j as %j', (input, expected) => {
    expect(quoteCmdArgIfNeeded(input)).toBe(expected)
  })
})
