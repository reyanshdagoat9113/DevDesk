import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectDetailTabs } from './ProjectDetailTabs'

function panel(label: string) {
  return <div data-testid={`panel-${label}`}>Panel {label}</div>
}

describe('ProjectDetailTabs', () => {
  it('renders all standard tabs and shows overview by default', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
      />
    )

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Health' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Bugs' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'LLM' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Engine' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Git' })).toBeNull()

    expect(screen.getByTestId('panel-overview')).toBeTruthy()
  })

  it('shows llm, engine and git tabs when panels are provided', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        llmPanel={panel('llm')}
        enginePanel={panel('engine')}
        gitPanel={panel('git')}
      />
    )

    expect(screen.getByRole('tab', { name: 'LLM' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Engine' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Git' })).toBeTruthy()
  })

  it('switches to health tab on click', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Health' }))

    expect(screen.getByTestId('panel-health')).toBeTruthy()
  })

  it('switches to notes tab on click', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Notes' }))

    expect(screen.getByTestId('panel-notes')).toBeTruthy()
  })

  it('switches to bugs tab and shows placeholder', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Bugs' }))

    expect(screen.getByText(/Bug tracking integration/)).toBeTruthy()
  })

  it('renders custom bugs panel when provided', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
        bugsPanel={panel('custom-bugs')}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Bugs' }))

    expect(screen.getByTestId('panel-custom-bugs')).toBeTruthy()
  })

  it('respects defaultTab prop', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
        defaultTab="notes"
      />
    )

    expect(screen.getByTestId('panel-notes')).toBeTruthy()
  })

  it('switches to llm tab and renders llm panel', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        llmPanel={panel('llm')}
        enginePanel={null}
        gitPanel={null}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'LLM' }))

    expect(screen.getByTestId('panel-llm')).toBeTruthy()
  })

  it('switches to engine tab and renders engine panel', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={panel('engine')}
        gitPanel={null}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Engine' }))

    expect(screen.getByTestId('panel-engine')).toBeTruthy()
  })

  it('switches to git tab and renders git panel', async () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={panel('git')}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Git' }))

    expect(screen.getByTestId('panel-git')).toBeTruthy()
  })

  it('falls back to overview when defaultTab is llm but no llm panel', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
        defaultTab="llm"
      />
    )

    expect(screen.getByTestId('panel-overview')).toBeTruthy()
  })

  it('falls back to overview when defaultTab is engine but no engine panel', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
        defaultTab="engine"
      />
    )

    expect(screen.getByTestId('panel-overview')).toBeTruthy()
  })

  it('falls back to overview when defaultTab is git but no git panel', () => {
    render(
      <ProjectDetailTabs
        overviewPanel={panel('overview')}
        healthPanel={panel('health')}
        notesPanel={panel('notes')}
        enginePanel={null}
        gitPanel={null}
        defaultTab="git"
      />
    )

    expect(screen.getByTestId('panel-overview')).toBeTruthy()
  })
})
