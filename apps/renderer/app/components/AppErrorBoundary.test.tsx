import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function CrashingChild(): never {
  throw new Error('render crash')
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a reload fallback when a child throws', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()

    render(
      <AppErrorBoundary onReload={onReload}>
        <CrashingChild />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert', { name: /DevDesk failed to render\./ })).toBeTruthy()
    expect(screen.getByText('render crash')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
