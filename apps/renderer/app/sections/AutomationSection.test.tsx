import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AutomationSection } from './AutomationSection'
import type { Command, CommandChain, CommandTrigger, Project } from '../types'

vi.mock('./CommandsSection', () => ({
  CommandsSection: ({ onAddToChain }: { onAddToChain: (command: Command) => void }) => (
    <div>
      <p>Commands panel</p>
      <button type="button" onClick={() => onAddToChain({ id: 'cmd-1', name: 'Build', command: 'npm run build' } as Command)}>
        Add Build To Chain
      </button>
    </div>
  ),
}))

vi.mock('./CommandChainsPanel', () => ({
  CommandChainsPanel: ({ seedCommand }: { seedCommand: Command | null }) => (
    <div>Chains panel {seedCommand ? `Seeded: ${seedCommand.name}` : 'No seed'}</div>
  ),
}))

vi.mock('./CommandTriggersPanel', () => ({
  CommandTriggersPanel: () => <div>Triggers panel</div>,
}))

const commands: Command[] = [{ id: 'cmd-1', name: 'Build', command: 'npm run build' }]
const chains: CommandChain[] = []
const triggers: CommandTrigger[] = []
const projects: Project[] = [{ id: 'project-1', name: 'DevDesk', path: '/workspace/devdesk', type: 'node', icon: 'box', linkedContainerNames: [] }]

describe('AutomationSection', () => {
  it('renders commands by default and opens the create command action', async () => {
    const onOpenCreateCommand = vi.fn()
    render(
      <AutomationSection
        commands={commands}
        chains={chains}
        triggers={triggers}
        projects={projects}
        chainRuns={{}}
        onCreateChain={vi.fn()}
        onUpdateChain={vi.fn()}
        onRemoveChain={vi.fn()}
        onRunChain={vi.fn()}
        onCreateTrigger={vi.fn()}
        onUpdateTrigger={vi.fn()}
        onRemoveTrigger={vi.fn()}
        onOpenCreateCommand={onOpenCreateCommand}
      />,
    )

    expect(screen.getByText('Commands panel')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /New Command/i }))
    expect(onOpenCreateCommand).toHaveBeenCalled()
  })

  it('switches to chains and carries the seeded command through', async () => {
    render(
      <AutomationSection
        commands={commands}
        chains={chains}
        triggers={triggers}
        projects={projects}
        chainRuns={{}}
        onCreateChain={vi.fn()}
        onUpdateChain={vi.fn()}
        onRemoveChain={vi.fn()}
        onRunChain={vi.fn()}
        onCreateTrigger={vi.fn()}
        onUpdateTrigger={vi.fn()}
        onRemoveTrigger={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Add Build To Chain' }))

    expect(screen.getByText('Chains panel Seeded: Build')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /New Command/i })).toBeNull()
  })

  it('switches to the triggers tab', async () => {
    render(
      <AutomationSection
        commands={commands}
        chains={chains}
        triggers={triggers}
        projects={projects}
        chainRuns={{}}
        onCreateChain={vi.fn()}
        onUpdateChain={vi.fn()}
        onRemoveChain={vi.fn()}
        onRunChain={vi.fn()}
        onCreateTrigger={vi.fn()}
        onUpdateTrigger={vi.fn()}
        onRemoveTrigger={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: /Triggers/ }))
    expect(screen.getByText('Triggers panel')).toBeTruthy()
  })
})
