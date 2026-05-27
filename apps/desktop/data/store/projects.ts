import type { Project } from '../model'
import { parseJsonArray } from './normalize'
import { parseBoolean, VALID_PROJECT_TYPES } from './shared'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'

export async function createProject(project: Project): Promise<void> {
  await queueWrite(async () => withSqlTiming('createProject', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO projects (id, path, name, type, icon, linked_container_names, is_pinned, pinned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        project.id,
        project.path,
        project.name,
        project.type,
        project.icon,
        JSON.stringify(project.linkedContainerNames ?? []),
        project.isPinned ? 1 : 0,
        project.pinnedAt ?? null
      )
  }))
}

export async function removeProject(projectId: string): Promise<void> {
  await queueWrite(async () => withSqlTiming('removeProject', async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const transaction = database.transaction((id: string) => {
      database.prepare('DELETE FROM projects WHERE id = ?').run(id)
      database.prepare('DELETE FROM commands WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM chains WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM triggers WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM run_history WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM notes WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM engine_indexes WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM engine_search_sessions WHERE project_id = ?').run(id)
      database.prepare('DELETE FROM bug_reports WHERE project_id = ?').run(id)
    })
    transaction(projectId)
  }))
}

export async function renameProject(projectId: string, name: string): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare('UPDATE projects SET name = ? WHERE id = ?')
      .run(name, projectId)
    return result.changes > 0
  })
}

export async function updateProjectLinkedContainers(projectId: string, linkedContainerNames: string[]): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare('UPDATE projects SET linked_container_names = ? WHERE id = ?')
      .run(JSON.stringify(linkedContainerNames), projectId)
    return result.changes > 0
  })
}

export async function listProjects(): Promise<Project[]> {
  return withSqlTiming('listProjects', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, path, name, type, icon, linked_container_names, is_pinned, pinned_at FROM projects ORDER BY rowid ASC')
      .all() as Array<{
      id: string
      path: string
      name: string
      type: Project['type']
      icon: string
      linked_container_names: string | null
      is_pinned: number
      pinned_at: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      name: row.name,
      type: VALID_PROJECT_TYPES.has(row.type) ? row.type : 'unknown',
      icon: row.icon,
      linkedContainerNames: parseJsonArray(row.linked_container_names),
      isPinned: parseBoolean(row.is_pinned),
      pinnedAt: row.pinned_at ?? undefined,
    }))
  })
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT id, path, name, type, icon, linked_container_names, is_pinned, pinned_at FROM projects WHERE id = ?')
    .get(projectId) as {
    id: string
    path: string
    name: string
    type: Project['type']
    icon: string
    linked_container_names: string | null
    is_pinned: number
    pinned_at: string | null
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    path: row.path,
    name: row.name,
    type: VALID_PROJECT_TYPES.has(row.type) ? row.type : 'unknown',
    icon: row.icon,
    linkedContainerNames: parseJsonArray(row.linked_container_names),
    isPinned: parseBoolean(row.is_pinned),
    pinnedAt: row.pinned_at ?? undefined,
  }
}

export async function toggleProjectPin(projectId: string): Promise<Project | null> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const row = database
      .prepare('SELECT is_pinned, pinned_at FROM projects WHERE id = ?')
      .get(projectId) as { is_pinned: number; pinned_at: string | null } | undefined

    if (!row) {
      return null
    }

    const isCurrentlyPinned = parseBoolean(row.is_pinned)
    const newPinnedState = !isCurrentlyPinned
    const newPinnedAt = newPinnedState ? new Date().toISOString() : null

    database
      .prepare('UPDATE projects SET is_pinned = ?, pinned_at = ? WHERE id = ?')
      .run(newPinnedState ? 1 : 0, newPinnedAt, projectId)

    return getProjectById(projectId)
  })
}
