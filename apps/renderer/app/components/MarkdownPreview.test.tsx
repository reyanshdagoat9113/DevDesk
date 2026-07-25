import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'

vi.mock('./RunnableBlock', () => ({
  RunnableBlock: () => <pre data-testid="runnable-block">Runnable block</pre>,
}))

describe('MarkdownPreview', () => {
  it('emits the task index when a preview checkbox is toggled', async () => {
    const onTaskToggle = vi.fn()

    render(
      <MarkdownPreview
        source={['- [ ] First task', '- [x] Second task'].join('\n')}
        onTaskToggle={onTaskToggle}
      />
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Toggle task 2' }))

    expect(onTaskToggle).toHaveBeenCalledWith(1)
  })
})
