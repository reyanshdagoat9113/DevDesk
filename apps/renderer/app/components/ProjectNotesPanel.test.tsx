import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('serializes autosaves so older notes cannot overwrite newer notes', async () => {
    let resolveFirst: (() => void) | undefined
    const updateProjectNotes = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(undefined)
    const onUpdateNotes = vi.fn()
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        getProjectNotes: vi.fn(async () => ({ projectId: 'project-1', setupSteps: '', todos: '', reminders: '' })),
        updateProjectNotes,
      },
    })

    render(<ProjectNotesPanel projectId="project-1" onUpdateNotes={onUpdateNotes} />)
    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: 'First draft' } })
    await waitFor(() => expect(updateProjectNotes).toHaveBeenCalledTimes(1))
    fireEvent.change(editor, { target: { value: 'Final draft' } })
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(updateProjectNotes).toHaveBeenCalledTimes(1)
    await act(async () => resolveFirst?.())

    await waitFor(() => expect(updateProjectNotes).toHaveBeenLastCalledWith('project-1', expect.objectContaining({ setupSteps: 'Final draft' })))
    await waitFor(() => expect(onUpdateNotes).toHaveBeenLastCalledWith(expect.objectContaining({ setupSteps: 'Final draft' })))
  })
})
