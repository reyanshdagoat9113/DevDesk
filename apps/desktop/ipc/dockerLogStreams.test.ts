import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { afterEach, describe, it, vi } from 'vitest'
import { runningDockerLogSubscriptions } from './runtimeState'
import {
  attachDockerLogReaper,
  registerDockerLogSubscription,
  resetDockerLogReapersForTests,
  stopAllDockerLogSubscriptions,
  stopDockerLogSubscription,
} from './dockerLogStreams'

type FakeProcess = { kill: ReturnType<typeof vi.fn> }

function fakeProcess(): FakeProcess {
  return { kill: vi.fn() }
}

function asChild(process: FakeProcess): ChildProcessWithoutNullStreams {
  return process as unknown as ChildProcessWithoutNullStreams
}

function createFakeWebContents(id: number) {
  const emitter = new EventEmitter()
  const webContents = {
    id,
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener)
      return webContents
    }),
    once: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.once(event, listener)
      return webContents
    }),
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
  }
  return webContents
}

afterEach(() => {
  runningDockerLogSubscriptions.clear()
  resetDockerLogReapersForTests()
})

describe('dockerLogStreams', () => {
  it('register stores webContentsId and attaches reaper only once per id', () => {
    const webContents = createFakeWebContents(11)
    const first = fakeProcess()
    const second = fakeProcess()

    registerDockerLogSubscription({
      subscriptionId: 'sub-a',
      process: asChild(first),
      containerId: 'ctr-a',
      webContents,
    })
    registerDockerLogSubscription({
      subscriptionId: 'sub-b',
      process: asChild(second),
      containerId: 'ctr-b',
      webContents,
    })

    const storedA = runningDockerLogSubscriptions.get('sub-a')
    const storedB = runningDockerLogSubscriptions.get('sub-b')
    assert.ok(storedA)
    assert.ok(storedB)
    assert.equal(storedA.webContentsId, 11)
    assert.equal(storedB.webContentsId, 11)
    assert.equal(storedA.containerId, 'ctr-a')
    assert.equal(storedA.process, asChild(first))

    assert.equal(webContents.once.mock.calls.length, 1)
    assert.equal(webContents.once.mock.calls[0]?.[0], 'destroyed')
    const onEvents = webContents.on.mock.calls.map((call) => call[0]).sort()
    assert.deepEqual(onEvents, ['did-start-navigation', 'render-process-gone'])
  })

  it('stopDockerLogSubscription kills and removes', () => {
    const process = fakeProcess()
    runningDockerLogSubscriptions.set('sub-kill', {
      process: asChild(process),
      containerId: 'ctr',
      webContentsId: 1,
    })

    assert.equal(stopDockerLogSubscription('sub-kill'), true)
    assert.equal(process.kill.mock.calls.length, 1)
    assert.equal(runningDockerLogSubscriptions.has('sub-kill'), false)
  })

  it('stop for missing id returns false', () => {
    assert.equal(stopDockerLogSubscription('missing'), false)
  })

  it('swallows kill errors and still removes the subscription', () => {
    const process = fakeProcess()
    process.kill.mockImplementation(() => {
      throw new Error('already dead')
    })
    runningDockerLogSubscriptions.set('sub-dead', {
      process: asChild(process),
      containerId: 'ctr',
      webContentsId: 1,
    })

    assert.equal(stopDockerLogSubscription('sub-dead'), true)
    assert.equal(runningDockerLogSubscriptions.has('sub-dead'), false)
  })

  it('destroyed event reaps only that webContents streams, not others', () => {
    const firstContents = createFakeWebContents(21)
    const secondContents = createFakeWebContents(22)
    const first = fakeProcess()
    const second = fakeProcess()

    registerDockerLogSubscription({
      subscriptionId: 'sub-first',
      process: asChild(first),
      containerId: 'ctr-1',
      webContents: firstContents,
    })
    registerDockerLogSubscription({
      subscriptionId: 'sub-second',
      process: asChild(second),
      containerId: 'ctr-2',
      webContents: secondContents,
    })

    firstContents.emit('destroyed')

    assert.equal(first.kill.mock.calls.length, 1)
    assert.equal(second.kill.mock.calls.length, 0)
    assert.equal(runningDockerLogSubscriptions.has('sub-first'), false)
    assert.equal(runningDockerLogSubscriptions.has('sub-second'), true)
  })

  it('did-start-navigation with isMainFrame true and isInPlace false reaps', () => {
    const webContents = createFakeWebContents(31)
    const process = fakeProcess()
    registerDockerLogSubscription({
      subscriptionId: 'sub-nav',
      process: asChild(process),
      containerId: 'ctr',
      webContents,
    })

    webContents.emit('did-start-navigation', {}, 'app://reload', false, true)

    assert.equal(process.kill.mock.calls.length, 1)
    assert.equal(runningDockerLogSubscriptions.has('sub-nav'), false)
  })

  it('did-start-navigation with isInPlace true does not reap', () => {
    const webContents = createFakeWebContents(32)
    const process = fakeProcess()
    registerDockerLogSubscription({
      subscriptionId: 'sub-inplace',
      process: asChild(process),
      containerId: 'ctr',
      webContents,
    })

    webContents.emit('did-start-navigation', {}, 'app://hash', true, true)

    assert.equal(process.kill.mock.calls.length, 0)
    assert.equal(runningDockerLogSubscriptions.has('sub-inplace'), true)
  })

  it('did-start-navigation without flags still reaps', () => {
    const webContents = createFakeWebContents(33)
    const process = fakeProcess()
    registerDockerLogSubscription({
      subscriptionId: 'sub-flags',
      process: asChild(process),
      containerId: 'ctr',
      webContents,
    })

    webContents.emit('did-start-navigation', {})

    assert.equal(process.kill.mock.calls.length, 1)
    assert.equal(runningDockerLogSubscriptions.has('sub-flags'), false)
  })

  it('stopAll clears everything', () => {
    const first = fakeProcess()
    const second = fakeProcess()
    runningDockerLogSubscriptions.set('sub-a', {
      process: asChild(first),
      containerId: 'a',
      webContentsId: 1,
    })
    runningDockerLogSubscriptions.set('sub-b', {
      process: asChild(second),
      containerId: 'b',
      webContentsId: 2,
    })

    stopAllDockerLogSubscriptions()

    assert.equal(first.kill.mock.calls.length, 1)
    assert.equal(second.kill.mock.calls.length, 1)
    assert.equal(runningDockerLogSubscriptions.size, 0)
  })

  it('attach is idempotent: two registers, one webContents, destroyed kills each process once', () => {
    const webContents = createFakeWebContents(41)
    const first = fakeProcess()
    const second = fakeProcess()

    registerDockerLogSubscription({
      subscriptionId: 'sub-1',
      process: asChild(first),
      containerId: 'ctr-1',
      webContents,
    })
    registerDockerLogSubscription({
      subscriptionId: 'sub-2',
      process: asChild(second),
      containerId: 'ctr-2',
      webContents,
    })
    attachDockerLogReaper(webContents)

    assert.equal(webContents.once.mock.calls.length, 1)

    webContents.emit('destroyed')

    assert.equal(first.kill.mock.calls.length, 1)
    assert.equal(second.kill.mock.calls.length, 1)
    assert.equal(runningDockerLogSubscriptions.size, 0)
  })

  it('destroyed removes the attached id so a recycled webContents can attach again', () => {
    const first = createFakeWebContents(50)
    attachDockerLogReaper(first)
    first.emit('destroyed')

    const recycled = createFakeWebContents(50)
    attachDockerLogReaper(recycled)
    assert.equal(recycled.once.mock.calls.length, 1)
    assert.equal(recycled.once.mock.calls[0]?.[0], 'destroyed')
  })
})
