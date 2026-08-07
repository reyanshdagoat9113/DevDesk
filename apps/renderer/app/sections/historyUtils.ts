import type { Command, Project, RunHistoryEntry } from '../types'

export type HistoryDateFilter = 'all' | 'today' | '7d' | '30d'
export type HistorySort = 'newest' | 'oldest' | 'duration' | 'status'

export function getRunDurationMs(entry: RunHistoryEntry, now = Date.now()): number | null {
  const start = Date.parse(entry.startTime)
  if (!Number.isFinite(start)) return null
  const end = entry.endTime ? Date.parse(entry.endTime) : now
  if (!Number.isFinite(end)) return null
  return Math.max(0, end - start)
}

export function formatRunDuration(durationMs: number | null): string {
  if (durationMs === null) return 'Unknown duration'
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.floor((durationMs % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function getRunExitCode(entry: RunHistoryEntry): number | null {
  const explicitCode = entry.output?.match(/(?:exit\s+)?code\s*[:=]\s*(-?\d+)/i)?.[1]
  if (explicitCode) return Number(explicitCode)
  if (entry.status === 'success') return 0
  return null
}

export function formatRunExitCode(entry: RunHistoryEntry): string {
  const code = getRunExitCode(entry)
  if (code !== null) return String(code)
  if (entry.status === 'running') return 'Pending'
  if (entry.status === 'stopped') return 'Unavailable'
  return 'Unavailable'
}

export function getFailureSummary(entry: RunHistoryEntry): string {
  if (entry.status === 'running') return 'Still running'
  if (entry.status === 'success') return 'Completed successfully'
  if (entry.status === 'stopped') return 'Stopped before completion'

  const firstUsefulLine = entry.output
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstUsefulLine) return 'Command failed without captured output'
  return firstUsefulLine.length > 140 ? `${firstUsefulLine.slice(0, 137)}…` : firstUsefulLine
}

export function filterAndSortHistory(
  history: RunHistoryEntry[],
  options: {
    query?: string
    projectId?: string
    status?: RunHistoryEntry['status'] | 'all'
    date?: HistoryDateFilter
    sort?: HistorySort
    commandsById: Record<string, Command>
    projectsById: Record<string, Project>
    now?: number
  },
): RunHistoryEntry[] {
  const query = options.query?.trim().toLowerCase() ?? ''
  const now = options.now ?? Date.now()
  const dateCutoff = options.date === 'today'
    ? new Date(now).setHours(0, 0, 0, 0)
    : options.date === '7d'
      ? now - 7 * 24 * 60 * 60 * 1000
      : options.date === '30d'
        ? now - 30 * 24 * 60 * 60 * 1000
        : null

  const filtered = history.filter((entry) => {
    const command = options.commandsById[entry.commandId]
    const project = entry.projectId ? options.projectsById[entry.projectId] : undefined
    const searchable = [
      command?.name,
      command?.command,
      entry.resolvedCommand,
      project?.name,
      entry.output,
      getFailureSummary(entry),
    ].filter(Boolean).join(' ').toLowerCase()

    if (query && !searchable.includes(query)) return false
    if (options.projectId && options.projectId !== 'all' && entry.projectId !== options.projectId) return false
    if (options.status && options.status !== 'all' && entry.status !== options.status) return false
    if (dateCutoff !== null && Date.parse(entry.startTime) < dateCutoff) return false
    return true
  })

  return filtered.sort((a, b) => {
    if (options.sort === 'oldest') return Date.parse(a.startTime) - Date.parse(b.startTime)
    if (options.sort === 'duration') {
      return (getRunDurationMs(b, now) ?? -1) - (getRunDurationMs(a, now) ?? -1)
    }
    if (options.sort === 'status') {
      return a.status.localeCompare(b.status) || Date.parse(b.startTime) - Date.parse(a.startTime)
    }
    return Date.parse(b.startTime) - Date.parse(a.startTime)
  })
}
