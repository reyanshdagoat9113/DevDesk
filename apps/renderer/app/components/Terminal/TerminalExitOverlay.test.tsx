import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TerminalExitOverlay } from './TerminalExitOverlay'

describe('TerminalExitOverlay', () => {
  it('announces terminal exit as a modal and focuses/restores the close trigger', async () => {
    const user = userEvent.setup()
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.textContent = 'Terminal'
    document.body.append(trigger)
    trigger.focus()
    const onDismiss = vi.fn()
    const { unmount } = render(<TerminalExitOverlay exitCode={1} onDismiss={onDismiss} />)

    expect(screen.getByRole('dialog', { name: 'Terminal Exited' }).getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))

    await user.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps the dialog action reachable at narrow sizes and exposes errors', () => {
    render(<TerminalExitOverlay error="shell unavailable" />)

    expect(screen.getByRole('dialog', { name: 'Terminal Error' })).toBeTruthy()
    expect(screen.getByText('shell unavailable').className).toContain('text-sm')
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
