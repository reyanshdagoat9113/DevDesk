import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { runningDockerLogSubscriptions } from './runtimeState'

type DockerLogWebContents = {
  id: number
  once: (event: 'destroyed', listener: (...args: unknown[]) => void) => unknown
  on: {
    (event: 'render-process-gone', listener: (...args: unknown[]) => void): unknown
    (event: 'did-start-navigation', listener: (...args: unknown[]) => void): unknown
  }
}

const attachedWebContentsIds = new Set<number>()

export function stopDockerLogSubscription(subscriptionId: string): boolean {
  const running = runningDockerLogSubscriptions.get(subscriptionId)
  if (!running) {
    return false
  }
  try {
    running.process.kill()
  } catch {
    // process may already have exited
  }
  runningDockerLogSubscriptions.delete(subscriptionId)
  return true
}

export function stopDockerLogSubscriptionsForWebContents(webContentsId: number): void {
  for (const id of [...runningDockerLogSubscriptions.keys()]) {
    const running = runningDockerLogSubscriptions.get(id)
    if (running && running.webContentsId === webContentsId) {
      stopDockerLogSubscription(id)
    }
  }
}

export function stopAllDockerLogSubscriptions(): void {
  for (const id of [...runningDockerLogSubscriptions.keys()]) {
    stopDockerLogSubscription(id)
  }
}

function shouldReapOnNavigation(args: unknown[]): boolean {
  // Electron: (event, url, isInPlace, isMainFrame). Missing flags still reap.
  if (args.length < 4) {
    return true
  }
  const isInPlace = args[2]
  const isMainFrame = args[3]
  return Boolean(isMainFrame) && !isInPlace
}

export function attachDockerLogReaper(webContents: DockerLogWebContents): void {
  if (attachedWebContentsIds.has(webContents.id)) {
    return
  }
  attachedWebContentsIds.add(webContents.id)
  const webContentsId = webContents.id

  const reap = () => {
    stopDockerLogSubscriptionsForWebContents(webContentsId)
  }

  webContents.once('destroyed', () => {
    reap()
    attachedWebContentsIds.delete(webContentsId)
  })
  webContents.on('render-process-gone', reap)
  webContents.on('did-start-navigation', (...args: unknown[]) => {
    if (!shouldReapOnNavigation(args)) {
      return
    }
    reap()
  })
}

export function registerDockerLogSubscription(options: {
  subscriptionId: string
  process: ChildProcessWithoutNullStreams
  containerId: string
  webContents: DockerLogWebContents
}): void {
  runningDockerLogSubscriptions.set(options.subscriptionId, {
    process: options.process,
    containerId: options.containerId,
    webContentsId: options.webContents.id,
  })
  attachDockerLogReaper(options.webContents)
}

/** Clears reaper attachment tracking between tests. */
export function resetDockerLogReapersForTests(): void {
  attachedWebContentsIds.clear()
}
