/**
 * Shared in-memory runtime state for IPC handlers.
 * Domain registrars import maps from here instead of closing over registerIpc locals.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { CommandTriggerEvent, RunStatus } from '../data/model'

export type RunningCommand = {
  process: ChildProcessWithoutNullStreams
  output: string
  requestedStop: boolean
  completion: Promise<RunStatus>
}

export const runningCommands = new Map<string, RunningCommand>()

export type ChainStepRunPayload = {
  stepId: string
  commandId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'stopped' | 'skipped'
  runId?: string
  startedAt?: string
  endedAt?: string
  error?: string
}

export type ChainRunPayload = {
  runId: string
  chainId: string
  projectId?: string
  status: 'running' | 'success' | 'failed' | 'stopped'
  startedAt: string
  endedAt?: string
  activeStepId?: string
  error?: string
  steps: ChainStepRunPayload[]
}

export const runningChains = new Map<string, ChainRunPayload>()

export type TriggerConfirmationRequestPayload = {
  id: string
  triggerId: string
  triggerName: string
  chainId: string
  chainName: string
  event: CommandTriggerEvent
  projectId?: string
  projectName?: string
  containerNames?: string[]
  createdAt: string
}

export type PendingTriggerConfirmation = {
  request: TriggerConfirmationRequestPayload
  resolve: (approved: boolean) => void
  timeout: NodeJS.Timeout
}

export const pendingTriggerConfirmations = new Map<string, PendingTriggerConfirmation>()

export type RunningDockerLogSubscription = {
  process: ChildProcessWithoutNullStreams
  containerId: string
}

export const runningDockerLogSubscriptions = new Map<string, RunningDockerLogSubscription>()
