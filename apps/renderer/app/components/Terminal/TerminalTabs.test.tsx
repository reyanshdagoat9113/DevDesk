import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TerminalTabs } from './TerminalTabs'

vi.mock('./Terminal', () => ({
  Terminal: ({ terminalId }: { terminalId: string }) => <div data-testid={`terminal-${terminalId}`} />,
}))

const sessions = [
  { id: 'one', label: 'Shell one' },
  { id: 'two', label: 'Shell two' },
]

function renderTabs(overrides: Partial<React.ComponentProps<typeof TerminalTabs>> = {}) {
  return render(
    <TerminalTabs
      sessions={sessions}
      activeId="one"
      onSelectTab={vi.fn()}
      onCloseTab={vi.fn()}
      onCreateSession={vi.fn()}
      projects={[]}
      {...overrides}
    />
  )
}

describe('TerminalTabs', () => {
  it('uses sibling tab and close controls without nested interactive elements', () => {
    renderTabs()

    expect(screen.getByRole('tablist', { name: 'Terminal sessions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Shell one' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'Close terminal Shell one' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Shell one' }).querySelector('button')).toBeNull()
  })

  it('moves focus through tabs and closes only the requested session', async () => {
    const user = userEvent.setup()
    const onSelectTab = vi.fn()
    const onCloseTab = vi.fn()
    renderTabs({ onSelectTab, onCloseTab })

    await user.click(screen.getByRole('tab', { name: 'Shell one' }))
    await user.keyboard('{ArrowRight}')
    expect(onSelectTab).toHaveBeenLastCalledWith('two')
    await user.click(screen.getByRole('button', { name: 'Close terminal Shell one' }))
    expect(onCloseTab).toHaveBeenCalledWith('one')
  })

  it('transfers focus to rename and restores it after Escape', async () => {
    const user = userEvent.setup()
    renderTabs()
    const tab = screen.getByRole('tab', { name: 'Shell one' })

    await user.dblClick(tab)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Rename terminal Shell one' }))
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Shell one' }))
  })
})
