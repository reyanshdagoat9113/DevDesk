import { randomUUID } from 'node:crypto'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRunHistoryEntry, finalizeRunHistoryEntry } from '../data/store'
import type { RunStatus } from '../data/model'
import { runningCommands, type RunningCommand } from '../ipc/runtimeState'
import {
  appendRunOutput,
  createRunOutputBuffer,
  runOutputWasTruncated,
  serializeRunOutput,
  RUN_OUTPUT_TRUNCATION_MARKER,
} from '../system/runOutputBuffer'

export type StartedCommandRun = {
  runId: string
  status: 'running'
  startTime: string
  completion: Promise<RunStatus>
}

export async function startTrackedCommandRun(options: {
  commandId: string
  projectId: string
  finalCommand: string
  child: ChildProcessWithoutNullStreams
  broadcast: (channel: string, payload: unknown) => void
}): Promise<StartedCommandRun> {
  const runId = randomUUID()
  const startTime = new Date().toISOString()

  await createRunHistoryEntry({
    id: runId,
    commandId: options.commandId,
    projectId: options.projectId,
    status: 'running',
    startTime,
    output: '',
    resolvedCommand: options.finalCommand,
  })

  options.broadcast('runs:started', {
    id: runId,
    commandId: options.commandId,
    projectId: options.projectId,
    status: 'running',
    startTime,
    output: '',
    resolvedCommand: options.finalCommand,
  })

  let resolveCompletion: ((status: RunStatus) => void) | null = null
  const completion = new Promise<RunStatus>((resolve) => {
    resolveCompletion = resolve
  })

  const running: RunningCommand = {
    process: options.child,
    output: createRunOutputBuffer(),
    requestedStop: false,
    completion,
  }
  runningCommands.set(runId, running)

  const flushOutput = async (runStatus?: RunStatus) => {
    await finalizeRunHistoryEntry(runId, serializeRunOutput(running.output), runStatus)
  }

  const pushChunk = (chunk: Buffer) => {
    const text = chunk.toString()
    const alreadyTruncated = runOutputWasTruncated(running.output)
    appendRunOutput(running.output, text)
    options.broadcast('runs:output', { runId, chunk: text })
    if (!alreadyTruncated && runOutputWasTruncated(running.output)) {
      options.broadcast('runs:output', { runId, chunk: RUN_OUTPUT_TRUNCATION_MARKER })
    }
  }

  options.child.stdout.on('data', pushChunk)
  options.child.stderr.on('data', pushChunk)

  options.child.on('error', async (error) => {
    appendRunOutput(running.output, `\n${error.message}\n`)
    await flushOutput('failed')
    runningCommands.delete(runId)
    options.broadcast('runs:status', { runId, status: 'failed' })
    resolveCompletion?.('failed')
  })

  options.child.on('close', async (code) => {
    const status: RunStatus = running.requestedStop ? 'stopped' : code === 0 ? 'success' : 'failed'
    await flushOutput(status)
    runningCommands.delete(runId)
    options.broadcast('runs:status', { runId, status })
    resolveCompletion?.(status)
  })

  return {
    runId,
    status: 'running',
    startTime,
    completion,
  }
}
