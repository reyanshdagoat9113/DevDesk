import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectNotesPanel } from './ProjectNotesPanel'

describe('ProjectNotesPanel operation feedback', () => {
  it('shows an autosave timestamp after notes are saved', async () => {
    const updateProjectNotes = vi.fn(async () => undefined)
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getProjectNotes: vi.fn(async () => ({
          projectId: 'project-1',
          setupSteps: '',
          todos: '',
          reminders: '',
        })),
        updateProjectNotes,
      },
    })

    const user = userEvent.setup()
    render(<ProjectNotesPanel projectId="project-1" />)

    const editor = await screen.findByRole('textbox')
    await user.type(editor, 'Install dependencies')

    await waitFor(() => {
      expect(updateProjectNotes).toHaveBeenCalledWith('project-1', expect.objectContaining({ setupSteps: 'Install dependencies' }))
    })
    expect(screen.getByText(/Saved/)).toBeTruthy()
  })
})
