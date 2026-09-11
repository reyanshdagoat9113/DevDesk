import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CommandsSection } from './CommandsSection'
import type { Command, Project } from '../types'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

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
  { id: 'other', name: 'Other App', path: '/workspace/other', type: 'node', icon: 'box', linkedContainerNames: [] },
]
const command: Command = {
  id: 'build',
  name: 'Build',
  command: 'npm run build',
  projectId: 'app',
  workingDirectory: 'apps/desktop',
  description: 'Compile the app',
}
const testCommand: Command = { id: 'test', name: 'Test', command: 'npm test', projectId: 'app' }

function installCommandElectronApi(updateCommand = vi.fn()) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      detectCommandVariables: vi.fn(async () => []),
      getProjectDirectories: vi.fn(async () => ['apps', 'src']),
      updateCommand,
    },
  })
  return updateCommand
}

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

  it('exposes project and working directory in the edit dialog and can clear them', async () => {
    installCommandElectronApi()
    const onUpdateCommand = vi.fn(async () => {})

    render(
      <CommandsSection
        commands={[command]}
        projects={projects}
        onUpdateCommand={onUpdateCommand}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Edit command' }))

    expect(screen.getByText('Update the name, command, project, working directory, and metadata.')).toBeTruthy()
    expect(await screen.findByText('Project Root')).toBeTruthy()
    expect(screen.getAllByText('apps/desktop').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Back to projects' }))
    await userEvent.click(screen.getByText('Global Command'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onUpdateCommand).toHaveBeenCalledWith('build', expect.objectContaining({
        name: 'Build',
        command: 'npm run build',
        description: 'Compile the app',
        projectId: null,
        workingDirectory: null,
      }))
    })
  })

  it('saves a reassigned project and working directory from the edit dialog', async () => {
    installCommandElectronApi()
    const onUpdateCommand = vi.fn(async () => {})

    render(
      <CommandsSection
        commands={[command]}
        projects={projects}
        onUpdateCommand={onUpdateCommand}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Edit command' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Back to projects' }))
    await userEvent.click(screen.getByText('Other App'))
    await userEvent.click(await screen.findByText('src'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onUpdateCommand).toHaveBeenCalledWith('build', expect.objectContaining({
        projectId: 'other',
        workingDirectory: 'src',
      }))
    })
  })
})
