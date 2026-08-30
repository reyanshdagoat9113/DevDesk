import { describe, expect, it } from 'vitest'
import type { RunHistoryEntry } from '../types'
import { appendHistoryPage, applyRunOutput, applyRunStarted, applyRunStatus } from './runHistory'

const base: RunHistoryEntry = {
  id: 'run-1',
  commandId: 'cmd-1',
  projectId: 'proj-1',
  status: 'success',
  startTime: '2026-08-07T10:00:00.000Z',
}

describe('runHistory helpers', () => {
  it('prepends a newly started run', () => {
    const next = applyRunStarted([base], {
      id: 'run-2',
      commandId: 'cmd-2',
      startTime: '2026-08-07T11:00:00.000Z',
    })
    expect(next.map((entry) => entry.id)).toEqual(['run-2', 'run-1'])
    expect(next[0].status).toBe('running')
  })

  it('appends live output to the matching run', () => {
    const next = applyRunOutput([{ ...base, output: 'a' }], 'run-1', 'b')
    expect(next[0].output).toBe('ab')
  })

  it('records status and end time on completion', () => {
    const next = applyRunStatus([{ ...base, status: 'running' }], 'run-1', 'failed')
    expect(next[0].status).toBe('failed')
    expect(next[0].endTime).toBeTruthy()
  })

  it('appends unseen page rows and upserts known ids', () => {
    const next = appendHistoryPage(
      [{ ...base, output: 'kept' }],
      [
        { ...base, resolvedCommand: 'echo 1' },
        { id: 'run-2', commandId: 'cmd-2', status: 'success', startTime: '2026-08-07T09:00:00.000Z' },
      ],
    )
    expect(next).toHaveLength(2)
    expect(next[0].output).toBe('kept')
    expect(next[0].resolvedCommand).toBe('echo 1')
    expect(next[1].id).toBe('run-2')
  })
})
