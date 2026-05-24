import { describe, expect, it } from 'vitest'
import { getTaskProgress, toggleTaskAtIndex } from './markdownUtils'

describe('markdown task utilities', () => {
  it('counts completed and total task items', () => {
    const source = [
      '# Tasks',
      '- [ ] Install dependencies',
      '- [x] Wire IPC',
      '  - [X] Nested task',
      '- Not a task',
    ].join('\n')

    expect(getTaskProgress(source)).toEqual({ completed: 2, total: 3 })
  })

  it('toggles a task item by task index while preserving surrounding markdown', () => {
    const source = [
      '- [ ] First task',
      '',
      '1. [x] Second task',
      '* [ ] Third task',
    ].join('\r\n')

    expect(toggleTaskAtIndex(source, 1)).toBe(
      [
        '- [ ] First task',
        '',
        '1. [ ] Second task',
        '* [ ] Third task',
      ].join('\r\n')
    )
  })

  it('returns the original source when the task index is not present', () => {
    const source = '- [ ] First task'

    expect(toggleTaskAtIndex(source, 3)).toBe(source)
    expect(toggleTaskAtIndex(source, -1)).toBe(source)
  })
})
