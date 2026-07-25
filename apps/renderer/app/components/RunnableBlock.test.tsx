import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RunnableBlock } from './RunnableBlock'

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}))

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}))

const clipboardWrite = vi.fn()
Object.assign(navigator, {
  clipboard: { writeText: clipboardWrite },
})

const runAdhocCommand = vi.fn()

beforeAll(() => {
  ;(window as unknown as Record<string, unknown>).electronAPI = {
    runAdhocCommand,
  }
})

describe('RunnableBlock', () => {
  it('renders code with syntax highlighting', () => {
    render(<RunnableBlock code="npm run build" language="bash" runnable={false} />)

    expect(screen.getByTestId('syntax-highlighter')).toBeTruthy()
    expect(screen.getByText('npm run build')).toBeTruthy()
    expect(screen.getByText('bash')).toBeTruthy()
  })

  it('shows copy button and copies to clipboard', async () => {
    clipboardWrite.mockResolvedValueOnce(undefined)

    render(<RunnableBlock code="echo hello" language="bash" runnable={false} />)

    await userEvent.click(screen.getByText('Copy'))
    expect(clipboardWrite).toHaveBeenCalledWith('echo hello')
  })

  it('shows run button when runnable and projectId provided', () => {
    render(
      <RunnableBlock code="npm test" language="bash" runnable={true} projectId="p1" />
    )

    expect(screen.getByText('Run')).toBeTruthy()
  })

  it('shows warning when runnable but no project selected', () => {
    render(<RunnableBlock code="npm test" language="bash" runnable={true} />)

    expect(screen.getByText('Run')).toBeTruthy()
    expect(screen.getByText(/Select a project before running/)).toBeTruthy()
  })

  it('opens confirmation dialog on run click', async () => {
    runAdhocCommand.mockResolvedValueOnce({ runId: 'run-123', status: 'started', startTime: new Date().toISOString() })

    render(
      <RunnableBlock code="npm test" language="bash" runnable={true} projectId="p1" />
    )

    await userEvent.click(screen.getByText('Run'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Run wiki command?')).toBeTruthy()
    expect(within(dialog).getByText('npm test')).toBeTruthy()

    await userEvent.click(within(dialog).getByText('Run Command'))
    expect(runAdhocCommand).toHaveBeenCalledWith('p1', 'npm test')
  })

  it('cancels confirmation dialog', async () => {
    render(
      <RunnableBlock code="npm test" language="bash" runnable={true} projectId="p1" />
    )

    await userEvent.click(screen.getByText('Run'))
    expect(screen.getByText('Run wiki command?')).toBeTruthy()

    await userEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Run wiki command?')).toBeNull()
  })

  it('shows error when adhoc command needs input', async () => {
    runAdhocCommand.mockResolvedValueOnce({ status: 'needs-input', inputs: [], preview: '' })

    render(
      <RunnableBlock code="echo {{ input }}" language="bash" runnable={true} projectId="p1" />
    )

    await userEvent.click(screen.getByText('Run'))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByText('Run Command'))

    expect(runAdhocCommand).toHaveBeenCalled()
    expect(within(dialog).getByText(/unresolved variables/)).toBeTruthy()
  })

  it('shows error when adhoc command throws', async () => {
    runAdhocCommand.mockRejectedValueOnce(new Error('Network error'))

    render(
      <RunnableBlock code="bad command" language="bash" runnable={true} projectId="p1" />
    )

    await userEvent.click(screen.getByText('Run'))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByText('Run Command'))

    expect(within(dialog).getByText('Network error')).toBeTruthy()
  })

  it('does not show :run suffix when not runnable', () => {
    render(<RunnableBlock code="const x = 1" language="typescript" runnable={false} />)

    expect(screen.getByText('typescript')).toBeTruthy()
    expect(screen.queryByText('typescript:run')).toBeNull()
  })

  it('shows :run suffix when runnable', () => {
    render(
      <RunnableBlock code="npm start" language="bash" runnable={true} projectId="p1" />
    )

    expect(screen.getByText('bash:run')).toBeTruthy()
  })

  it('shows "text" as default language when none provided', () => {
    render(<RunnableBlock code="plain text" runnable={false} />)

    expect(screen.getByText('text')).toBeTruthy()
  })

  it('does not show run button when not runnable', () => {
    render(<RunnableBlock code="some code" language="python" runnable={false} />)

    expect(screen.queryByText('Run')).toBeNull()
  })

  it('disables run button when already running', async () => {
    let resolvePromise: (value: unknown) => void = () => {}
    runAdhocCommand.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(
      <RunnableBlock code="long command" language="bash" runnable={true} projectId="p1" />
    )

    await userEvent.click(screen.getByText('Run'))
    await userEvent.click(screen.getByText('Run Command'))

    const runButton = screen.getByText('Run Command')
    expect(runButton.closest('button')?.disabled).toBe(true)

    resolvePromise({ runId: 'run-456', status: 'started', startTime: new Date().toISOString() })
  })
})
