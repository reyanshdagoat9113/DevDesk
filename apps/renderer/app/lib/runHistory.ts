import type { RunHistoryEntry, RunStatus } from '../types'
import { upsertHistoryEntry } from './appShell'

export const HISTORY_PAGE_SIZE = 200

export function applyRunStarted(
  history: RunHistoryEntry[],
  entry: {
    id: string
    commandId: string
    projectId?: string
    startTime: string
    output?: string
    resolvedCommand?: string
  },
): RunHistoryEntry[] {
  return upsertHistoryEntry(history, {
    id: entry.id,
    commandId: entry.commandId,
    projectId: entry.projectId,
    status: 'running',
    startTime: entry.startTime,
    output: entry.output ?? '',
    resolvedCommand: entry.resolvedCommand,
  })
}

export function applyRunOutput(history: RunHistoryEntry[], runId: string, chunk: string): RunHistoryEntry[] {
  return history.map((entry) =>
    entry.id === runId
      ? {
          ...entry,
          output: `${entry.output ?? ''}${chunk}`,
        }
      : entry,
  )
}

export function applyRunStatus(history: RunHistoryEntry[], runId: string, status: RunStatus): RunHistoryEntry[] {
  return history.map((entry) =>
    entry.id === runId
      ? {
          ...entry,
          status,
          endTime: new Date().toISOString(),
        }
      : entry,
  )
}

export function appendHistoryPage(
  prev: RunHistoryEntry[],
  entries: Array<Omit<RunHistoryEntry, 'output'> | RunHistoryEntry>,
): RunHistoryEntry[] {
  const knownIds = new Set(prev.map((entry) => entry.id))
  let next = prev
  const additions: RunHistoryEntry[] = []
  for (const entry of entries) {
    if (knownIds.has(entry.id)) {
      next = upsertHistoryEntry(next, entry)
    } else {
      additions.push(entry)
    }
  }
  return [...next, ...additions]
}
