import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installGlobalRuntimeErrorHandling, resetRuntimeErrorStateForTests } from '../lib/rendererErrors'
import { RuntimeErrorBanner } from './RuntimeErrorBanner'

function dispatchUnhandledRejection(reason: unknown) {
  const event = new Event('unhandledrejection', { cancelable: true }) as Event & { reason: unknown }
  event.reason = reason
  window.dispatchEvent(event)
  return event
}

function dispatchWindowError(error: unknown) {
  window.dispatchEvent(
    new ErrorEvent('error', {
      cancelable: true,
      message: error instanceof Error ? error.message : String(error),
      error,
    }),
  )
}

describe('RuntimeErrorBanner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    installGlobalRuntimeErrorHandling()
  })

  afterEach(() => {
    resetRuntimeErrorStateForTests()
  })

  it('shows a non-destructive banner for late rejections and keeps the app tree mounted', async () => {
    const user = userEvent.setup()
    render(
      <RuntimeErrorBanner>
        <div>workspace-alive</div>
      </RuntimeErrorBanner>,
    )

    expect(screen.getByText('workspace-alive')).toBeTruthy()

    act(() => {
      dispatchUnhandledRejection(new Error('late ipc failure'))
    })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('late ipc failure')).toBeTruthy()
    expect(screen.getByText('workspace-alive')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Something went wrong')).toBeNull()
    expect(screen.queryByText('late ipc failure')).toBeNull()
    expect(screen.getByText('workspace-alive')).toBeTruthy()
  })

  it('keeps the app tree mounted when a window error fires', async () => {
    render(
      <RuntimeErrorBanner>
        <div>workspace-alive</div>
      </RuntimeErrorBanner>,
    )

    act(() => {
      dispatchWindowError(new Error('late window error'))
    })

    expect(await screen.findByText('late window error')).toBeTruthy()
    expect(screen.getByText('workspace-alive')).toBeTruthy()
  })
})
