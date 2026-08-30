import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistorySection } from './HistorySection'
import type { Command, Project, RunHistoryEntry } from '../types'

const projects: Project[] = [
  { id: 'app', name: 'DevDesk', path: '/workspace/devdesk', type: 'node', icon: 'box', linkedContainerNames: [] },
  { id: 'docs', name: 'Docs', path: '/workspace/docs', type: 'node', icon: 'book', linkedContainerNames: [] },
]
const commands: Command[] = [
  { id: 'build', name: 'Build', command: 'npm run build' },
  { id: 'test', name: 'Test', command: 'npm test' },
]
const history: RunHistoryEntry[] = [
  {
    id: 'failed-build',
    commandId: 'build',
    projectId: 'app',
    status: 'failed',
    startTime: '2026-08-06T10:00:00.000Z',
    endTime: '2026-08-06T10:00:02.500Z',
    output: 'Error: TypeScript compilation failed',
  },
  {
    id: 'successful-test',
    commandId: 'test',
    projectId: 'docs',
    status: 'success',
    startTime: '2026-08-07T10:00:00.000Z',
    endTime: '2026-08-07T10:00:00.250Z',
    output: 'All tests passed',
  },
]

describe('HistorySection', () => {
  it('explains an empty history and links back to Commands', async () => {
    const onOpenCommands = vi.fn()

    render(
      <HistorySection
        history={[]}
        commands={commands}
        projects={projects}
        onOpenCommands={onOpenCommands}
      />,
    )

    expect(screen.getByText('No execution history yet')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Go to Commands' }))
    expect(onOpenCommands).toHaveBeenCalledOnce()
  })

  it('finds failed work and exposes duration, exit code, and failure summary', async () => {
    const user = userEvent.setup()
    render(
      <HistorySection
        history={history}
        commands={commands}
        projects={projects}
        onLoadOutput={vi.fn(async (runId) => history.find((entry) => entry.id === runId)?.output ?? '')}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Search history' }), 'build')

    expect(screen.getByText('1 of 2 runs')).toBeTruthy()
    expect(screen.getByText('Duration: 2.5s')).toBeTruthy()
    expect(screen.getByText('Exit code: Unavailable')).toBeTruthy()
    expect(screen.getAllByText('Error: TypeScript compilation failed').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Test.*Docs/ })).toBeNull()
  })

  it('ignores output that resolves after another run is selected', async () => {
    let resolveBuild: ((value: string) => void) | undefined
    const onLoadOutput = vi.fn((runId: string) => runId === 'failed-build'
      ? new Promise<string>((resolve) => { resolveBuild = resolve })
      : Promise.resolve('Current test output'))

    render(<HistorySection history={history.map((entry) => ({ ...entry, output: '' }))} commands={commands} projects={projects} onLoadOutput={onLoadOutput} />)

    await userEvent.click(screen.getByRole('button', { name: /Test/i }))
    await screen.findByText(/Current test output/)
    resolveBuild?.('Stale build output')

    await waitFor(() => expect(screen.queryByText(/Stale build output/)).toBeNull())
    expect(screen.getByText(/Current test output/)).toBeTruthy()
  })

  it('filters by project and status and can reset the view', async () => {
    const user = userEvent.setup()
    render(<HistorySection history={history} commands={commands} projects={projects} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter history by project' }), 'docs')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter history by status' }), 'success')

    expect(screen.getByText('1 of 2 runs')).toBeTruthy()
    expect(screen.getAllByText('Test').length).toBeGreaterThan(0)
    expect(screen.queryByText('Error: TypeScript compilation failed')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Clear filters/i }))
    expect(screen.getByText('2 of 2 runs')).toBeTruthy()
  })

  it('shows Load more only when hasMore and calls onLoadMore', async () => {
    const onLoadMore = vi.fn()
    const { rerender } = render(
      <HistorySection
        history={history}
        commands={commands}
        projects={projects}
        hasMore={false}
        onLoadMore={onLoadMore}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()

    rerender(
      <HistorySection
        history={history}
        commands={commands}
        projects={projects}
        hasMore
        onLoadMore={onLoadMore}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })
})
