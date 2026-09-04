import { killProcessTree } from '../system/processTree'
import { stopAllDockerLogSubscriptions } from './dockerLogStreams'
import { runningCommands } from './runtimeState'

/**
 * Best-effort stop of in-flight command-vault runs on app quit.
 * Snapshots the map first because close handlers (and this cleanup) mutate it.
 */
export async function stopAllRunningCommands(): Promise<void> {
  const snapshot = [...runningCommands.entries()]
  await Promise.all(
    snapshot.map(async ([id, running]) => {
      try {
        running.requestedStop = true
        await killProcessTree(running.process)
      } catch {
        // best-effort — one failure must not skip other runs
      }
      runningCommands.delete(id)
    }),
  )
}

/**
 * Best-effort kill of live docker log follow processes on app quit.
 * Snapshots ids first because close/error handlers mutate the map.
 */
export async function stopAllDockerLogSubscriptionsOnQuit(): Promise<void> {
  stopAllDockerLogSubscriptions()
}

/** Tear down running commands and docker log streams. Never throws. */
export async function cleanupOnQuit(): Promise<void> {
  try {
    await Promise.all([
      stopAllRunningCommands(),
      stopAllDockerLogSubscriptionsOnQuit(),
    ])
  } catch {
    // never throw from quit cleanup
  }
}
