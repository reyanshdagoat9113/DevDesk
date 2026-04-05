import type { ProjectNotes } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite } from './core'

export async function getProjectNotesById(projectId: string): Promise<ProjectNotes> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT project_id, setup_steps, todos, reminders FROM notes WHERE project_id = ?')
    .get(projectId) as { project_id: string; setup_steps: string; todos: string; reminders: string } | undefined

  if (!row) {
    return {
      projectId,
      setupSteps: '',
      todos: '',
      reminders: '',
    }
  }

  return {
    projectId: row.project_id,
    setupSteps: row.setup_steps,
    todos: row.todos,
    reminders: row.reminders,
  }
}

export async function upsertProjectNotes(projectId: string, updates: Partial<ProjectNotes>): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const current = await getProjectNotesById(projectId)
    const next = {
      projectId,
      setupSteps: updates.setupSteps ?? current.setupSteps,
      todos: updates.todos ?? current.todos,
      reminders: updates.reminders ?? current.reminders,
    }

    getDbOrThrow()
      .prepare(
        `
          INSERT INTO notes (project_id, setup_steps, todos, reminders)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            setup_steps = excluded.setup_steps,
            todos = excluded.todos,
            reminders = excluded.reminders
        `
      )
      .run(projectId, next.setupSteps, next.todos, next.reminders)
  })
}
