import { describe, expect, it } from 'vitest'
import type { Command, Project, RunHistoryEntry } from '../types'
import {
  filterAndSortHistory,
  formatRunDuration,
  formatRunExitCode,
  getFailureSummary,
  getRunDurationMs,
} from './historyUtils'

const commandsById: Record<string, Command> = {
  build: { id: 'build', name: 'Build', command: 'npm run build' },
  test: { id: 'test', name: 'Test', command: 'npm test' },
}

const projectsById: Record<string, Project> = {
  app: { id: 'app', name: 'DevDesk', path: '/workspace/devdesk', type: 'node', icon: 'box', linkedContainerNames: [] },
  docs: { id: 'docs', name: 'Docs', path: '/workspace/docs', type: 'node', icon: 'book', linkedContainerNames: [] },
}

const history: RunHistoryEntry[] = [
  {
    id: 'failed-build',
    commandId: 'build',
    projectId: 'app',
    status: 'failed',
    startTime: '2026-08-06T10:00:00.000Z',
    endTime: '2026-08-06T10:00:02.500Z',
    output: 'Error: TypeScript compilation failed',
  },
  {
    id: 'successful-test',
    commandId: 'test',
    projectId: 'docs',
    status: 'success',
    startTime: '2026-08-07T10:00:00.000Z',
    endTime: '2026-08-07T10:00:00.250Z',
  },
]

describe('historyUtils', () => {
  it('filters by query, project, status, and date, then sorts by duration', () => {
    const result = filterAndSortHistory(history, {
      query: 'build',
      projectId: 'app',
      status: 'failed',
      date: '7d',
      sort: 'duration',
      commandsById,
      projectsById,
      now: Date.parse('2026-08-07T12:00:00.000Z'),
    })

    expect(result.map((entry) => entry.id)).toEqual(['failed-build'])
  })

  it('formats duration, exit code, and a useful failure summary', () => {
    expect(getRunDurationMs(history[0])).toBe(2500)
    expect(formatRunDuration(2500)).toBe('2.5s')
    expect(formatRunExitCode(history[0])).toBe('Unavailable')
    expect(getFailureSummary(history[0])).toBe('Error: TypeScript compilation failed')
  })
})
