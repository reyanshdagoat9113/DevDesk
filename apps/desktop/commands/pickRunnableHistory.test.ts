import { describe, expect, it, vi } from 'vitest'
import { pickRunnableHistoryEntry, runFirstRunnableHistoryCommand } from './pickRunnableHistory'

describe('pickRunnableHistoryEntry', () => {
  const history = [
    { commandId: 'needs-input', projectId: 'app' },
    { commandId: 'missing', projectId: 'app' },
    { commandId: 'ok', projectId: 'docs' },
  ]

  it('skips missing and needs-input commands and returns the next runnable entry', () => {
    const picked = pickRunnableHistoryEntry(history, {
      commandExists: (commandId) => commandId !== 'missing',
      shouldSkip: (entry) => entry.commandId === 'needs-input',
    })
    expect(picked).toEqual({ commandId: 'ok', projectId: 'docs' })
  })

  it('returns undefined when nothing is runnable', () => {
    expect(
      pickRunnableHistoryEntry(history, {
        commandExists: () => false,
        shouldSkip: () => false,
      }),
    ).toBeUndefined()
  })
})

describe('runFirstRunnableHistoryCommand', () => {
  it('runs the most recent existing command that does not need input', async () => {
    const runCommand = vi.fn(async (command: { id: string }) =>
      command.id === 'prompt' ? { status: 'needs-input' } : { status: 'running' },
    )

    const result = await runFirstRunnableHistoryCommand({
      history: [
        { commandId: 'gone' },
        { commandId: 'prompt', projectId: 'app' },
        { commandId: 'ok', projectId: 'docs' },
      ],
      getCommand: async (id) => (id === 'gone' ? null : { id }),
      runCommand,
      isNeedsInput: (value) =>
        Boolean(value && typeof value === 'object' && 'status' in value && value.status === 'needs-input'),
    })

    expect(result).toEqual({ success: true })
    expect(runCommand.mock.calls.map((call) => call[0])).toEqual([{ id: 'prompt' }, { id: 'ok' }])
    expect(runCommand.mock.calls[1]?.[1]).toBe('docs')
  })

  it('returns a clear error when every existing command needs input', async () => {
    const result = await runFirstRunnableHistoryCommand({
      history: [{ commandId: 'prompt' }],
      getCommand: async (id) => ({ id }),
      runCommand: async () => ({ status: 'needs-input' }),
      isNeedsInput: () => true,
    })
    expect(result).toEqual({ success: false, error: 'No recent command can run without input variables.' })
  })
})
