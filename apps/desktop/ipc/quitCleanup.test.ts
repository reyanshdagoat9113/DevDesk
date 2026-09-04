import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { RunStatus } from '../data/model'
import type { RunningCommand, RunningDockerLogSubscription } from './runtimeState'

const { killProcessTree } = vi.hoisted(() => ({
  killProcessTree: vi.fn(async () => undefined),
}))

vi.mock('../system/processTree', () => ({
  killProcessTree,
}))

import { runningCommands, runningDockerLogSubscriptions } from './runtimeState'
import {
  cleanupOnQuit,
  stopAllDockerLogSubscriptionsOnQuit,
  stopAllRunningCommands,
} from './quitCleanup'

function fakeProcess(pid = 123) {
  return { kill: vi.fn(), pid } as unknown as ChildProcessWithoutNullStreams
}

function fakeRunningCommand(pid = 123): RunningCommand {
  return {
    process: fakeProcess(pid),
    output: {} as RunningCommand['output'],
    requestedStop: false,
    completion: Promise.resolve('stopped' as RunStatus),
  }
}

function fakeDockerSubscription(
  containerId: string,
  pid = 456,
): RunningDockerLogSubscription {
  return {
    process: fakeProcess(pid),
    containerId,
    webContentsId: 1,
  } as RunningDockerLogSubscription
}

afterEach(() => {
  runningCommands.clear()
  runningDockerLogSubscriptions.clear()
})

describe('stopAllRunningCommands', () => {
  it('sets requestedStop on every entry, tree-kills each process, and clears the map', async () => {
    const first = fakeRunningCommand(101)
    const second = fakeRunningCommand(102)
    runningCommands.set('run-a', first)
    runningCommands.set('run-b', second)

    await stopAllRunningCommands()

    expect(first.requestedStop).toBe(true)
    expect(second.requestedStop).toBe(true)
    expect(killProcessTree).toHaveBeenCalledTimes(2)
    expect(killProcessTree).toHaveBeenCalledWith(first.process)
    expect(killProcessTree).toHaveBeenCalledWith(second.process)
    expect(runningCommands.size).toBe(0)
  })

  it('kills every running command, not just the first', async () => {
    const processes = [fakeProcess(201), fakeProcess(202), fakeProcess(203)]
    processes.forEach((process, index) => {
      runningCommands.set(`run-${index}`, {
        process,
        output: {} as RunningCommand['output'],
        requestedStop: false,
        completion: Promise.resolve('stopped' as RunStatus),
      })
    })

    await stopAllRunningCommands()

    expect(killProcessTree).toHaveBeenCalledTimes(3)
    for (const process of processes) {
      expect(killProcessTree).toHaveBeenCalledWith(process)
    }
    expect(runningCommands.size).toBe(0)
  })
})

describe('stopAllDockerLogSubscriptionsOnQuit', () => {
  it('kills each docker log child and clears the map', async () => {
    const first = fakeDockerSubscription('ctr-a', 301)
    const second = fakeDockerSubscription('ctr-b', 302)
    runningDockerLogSubscriptions.set('sub-a', first)
    runningDockerLogSubscriptions.set('sub-b', second)

    await stopAllDockerLogSubscriptionsOnQuit()

    expect(first.process.kill).toHaveBeenCalledTimes(1)
    expect(second.process.kill).toHaveBeenCalledTimes(1)
    expect(runningDockerLogSubscriptions.size).toBe(0)
  })
})

describe('cleanupOnQuit', () => {
  it('does not let a killProcessTree failure skip other commands, and does not throw', async () => {
    const failing = fakeRunningCommand(401)
    const surviving = fakeRunningCommand(402)
    runningCommands.set('run-fail', failing)
    runningCommands.set('run-ok', surviving)

    killProcessTree.mockImplementation(async (child) => {
      if (child === failing.process) {
        throw new Error('tree-kill failed')
      }
    })

    await expect(cleanupOnQuit()).resolves.toBeUndefined()

    expect(failing.requestedStop).toBe(true)
    expect(surviving.requestedStop).toBe(true)
    expect(killProcessTree).toHaveBeenCalledWith(failing.process)
    expect(killProcessTree).toHaveBeenCalledWith(surviving.process)
    expect(runningCommands.size).toBe(0)
  })

  it('invokes both command and docker log cleanup', async () => {
    const command = fakeRunningCommand(501)
    const subscription = fakeDockerSubscription('ctr-quit', 502)
    runningCommands.set('run-quit', command)
    runningDockerLogSubscriptions.set('sub-quit', subscription)

    await cleanupOnQuit()

    expect(command.requestedStop).toBe(true)
    expect(killProcessTree).toHaveBeenCalledWith(command.process)
    expect(subscription.process.kill).toHaveBeenCalledTimes(1)
    expect(runningCommands.size).toBe(0)
    expect(runningDockerLogSubscriptions.size).toBe(0)
  })

  it('resolves without throwing when both maps are empty', async () => {
    await expect(cleanupOnQuit()).resolves.toBeUndefined()
    expect(killProcessTree).not.toHaveBeenCalled()
    expect(runningCommands.size).toBe(0)
    expect(runningDockerLogSubscriptions.size).toBe(0)
  })
})
