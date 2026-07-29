import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installElectronApiFake } from '../../test/createElectronApiFake'
import { RunnableBlock } from './RunnableBlock'

describe('RunnableBlock wiring', () => {
  beforeEach(() => {
    installElectronApiFake({
      runAdhocCommand: vi.fn(async () => ({ runId: 'run-1', status: 'running', startTime: new Date().toISOString() })),
    })
  })

  it('invokes runAdhocCommand with the fence command when project is set', async () => {
    const user = userEvent.setup()
    render(
      <RunnableBlock
        code="echo hello"
        language="bash"
        projectId="proj-1"
        runnable
      />,
    )

    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(await screen.findByRole('button', { name: /run command/i }))

    await waitFor(() => {
      expect(window.electronAPI.runAdhocCommand).toHaveBeenCalledWith('proj-1', 'echo hello')
    })
  })
})
