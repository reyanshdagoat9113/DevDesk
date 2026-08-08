import { ipcMain } from 'electron'
import { getProjectNotesById, upsertProjectNotes } from '../../data/store'
import type { ProjectNotes } from '../../data/model'

/** Domain registrar: project notes channels only. */
export function registerNotesHandlers(): void {
  ipcMain.handle('notes:get', async (_event, projectId: string) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }
    return getProjectNotesById(projectId)
  })

  ipcMain.handle('notes:update', async (_event, projectId: string, updates: Partial<ProjectNotes>) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }
    const sanitized: Partial<ProjectNotes> = {}
    if (typeof updates.setupSteps === 'string') {
      sanitized.setupSteps = updates.setupSteps
    }
    if (typeof updates.todos === 'string') {
      sanitized.todos = updates.todos
    }
    if (typeof updates.reminders === 'string') {
      sanitized.reminders = updates.reminders
    }
    await upsertProjectNotes(projectId, sanitized)
  })
}
