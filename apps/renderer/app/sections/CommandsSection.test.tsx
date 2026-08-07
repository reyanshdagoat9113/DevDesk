import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CommandsSection } from './CommandsSection'
import type { Command, Project } from '../types'

vi.mock('../layout/SectionLayout', () => ({
  SectionLayout: ({ list, detail }: { list: React.ReactNode; detail: React.ReactNode }) => (
    <div><section>{list}</section><section>{detail}</section></div>
  ),
}))

vi.mock('../components/CommandPresetPickerDialog', () => ({
  CommandPresetPickerDialog: () => null,
}))

vi.mock('../components/VariablePromptModal', () => ({
  VariablePromptModal: () => null,
}))

const projects: Project[] = [
  { id: 'app', name: 'DevDesk', path: '/workspace/devdesk', type: 'node', icon: 'box', linkedContainerNames: [] },
]
const command: Command = {
  id: 'build',
  name: 'Build',
  command: 'npm run build',
  projectId: 'app',
}
const testCommand: Command = { id: 'test', name: 'Test', command: 'npm test', projectId: 'app' }

describe('CommandsSection', () => {
  it('explains an empty command list and opens the create workflow', async () => {
    const onOpenCreateCommand = vi.fn()

    render(
      <CommandsSection
        commands={[]}
        projects={projects}
        onOpenCreateCommand={onOpenCreateCommand}
      />,
    )

    expect(screen.getByText('No commands saved yet')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Create command' }))
    expect(onOpenCreateCommand).toHaveBeenCalledOnce()
  })

  it('does not show another command\'s output link after selection changes', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { detectCommandVariables: vi.fn(async () => []) },
    })
    render(
      <CommandsSection
        commands={[command, testCommand]}
        projects={projects}
        onRunCommand={vi.fn(async () => ({ runId: 'run-1', status: 'running' }))}
        onOpenHistory={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Execute Script/i }))
    await screen.findByRole('button', { name: /View output/i })
    await userEvent.click(screen.getByRole('button', { name: /Test/ }))

    expect(screen.queryByRole('button', { name: /View output/i })).toBeNull()
  })

  it('keeps a project-scoped command on its project and opens its run in History', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { detectCommandVariables: vi.fn(async () => []) },
    })
    const onRunCommand = vi.fn(async () => ({ runId: 'run-1', status: 'running' }))
    const onOpenHistory = vi.fn()

    render(
      <CommandsSection
        commands={[command]}
        projects={projects}
        onRunCommand={onRunCommand}
        onOpenHistory={onOpenHistory}
      />,
    )

    const projectSelect = screen.getByRole('combobox', { name: 'Target Deployment Project' }) as HTMLSelectElement
    expect(projectSelect.value).toBe('app')
    expect(projectSelect.disabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /Execute Script/i }))
    await waitFor(() => expect(onRunCommand).toHaveBeenCalledWith('build', 'app'))

    await userEvent.click(screen.getByRole('button', { name: /View output/i }))
    expect(onOpenHistory).toHaveBeenCalledWith('run-1')
  })
})
