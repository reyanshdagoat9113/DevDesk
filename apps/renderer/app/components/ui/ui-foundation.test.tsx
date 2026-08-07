import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Badge,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  StatusNotice,
  ToolbarButton,
} from './index'

describe('renderer UI foundation', () => {
  it('composes a semantic Panel from shared parts', () => {
    render(
      <Panel>
        <PanelHeader>
          <PanelTitle>Project status</PanelTitle>
        </PanelHeader>
        <PanelContent>Everything is up to date.</PanelContent>
      </Panel>
    )

    expect(screen.getByText('Project status').tagName).toBe('H3')
    expect(screen.getByText('Everything is up to date.')).toBeTruthy()
  })

  it('renders empty state content and an optional action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <EmptyState
        title="No projects yet"
        description="Add a project to get started."
        icon={<span data-testid="empty-icon">+</span>}
        action={<button type="button" onClick={onClick}>Add project</button>}
      />
    )

    expect(screen.getByText('No projects yet')).toBeTruthy()
    expect(screen.getByTestId('empty-icon').parentElement?.getAttribute('aria-hidden')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Add project' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('announces loading and error recovery states accessibly', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<LoadingState label="Loading project data" description="This may take a moment." />)
    expect(screen.getByRole('status', { name: 'Loading project data' })).toBeTruthy()

    render(<ErrorState title="Could not load project" description="The project service is unavailable." onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert', { name: /Could not load project/ })).toBeTruthy()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('maps status tones to semantic attributes and announcement roles', () => {
    const { rerender } = render(<StatusNotice tone="success" title="Saved">Project saved.</StatusNotice>)

    expect(screen.getByRole('status', { name: /Saved/ }).getAttribute('data-status')).toBe('success')

    rerender(<StatusNotice tone="error" title="Save failed">Try again.</StatusNotice>)
    expect(screen.getByRole('alert', { name: /Save failed/ }).getAttribute('data-status')).toBe('error')
  })

  it('keeps badges non-interactive and gives compact actions explicit semantics', async () => {
    const user = userEvent.setup()
    const onIconClick = vi.fn()
    const onToolbarClick = vi.fn()

    render(
      <>
        <Badge variant="success">Ready</Badge>
        <IconButton aria-label="Refresh project" onClick={onIconClick}><span aria-hidden="true">*</span></IconButton>
        <ToolbarButton onClick={onToolbarClick}>Refresh</ToolbarButton>
      </>
    )

    expect(screen.getByText('Ready').tagName).toBe('SPAN')
    expect(screen.getByText('Ready').getAttribute('role')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Refresh project' }))
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onIconClick).toHaveBeenCalledOnce()
    expect(onToolbarClick).toHaveBeenCalledOnce()
  })
})
