import type { Command } from '../model'
import { parseJsonArray, parseVariables } from './normalize'
import { parseBoolean } from './shared'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'

export async function createCommand(command: Command): Promise<void> {
  await queueWrite(async () => withSqlTiming('createCommand', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO commands (id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        command.id,
        command.name,
        command.command,
        command.description ?? null,
        command.tags ? JSON.stringify(command.tags) : null,
        command.projectId ?? null,
        command.workingDirectory ?? null,
        command.variables ? JSON.stringify(command.variables) : null,
        command.isPinned ? 1 : 0,
        command.pinnedAt ?? null
      )
  }))
}

export async function replaceCommand(command: Command): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE commands
          SET name = ?, command = ?, description = ?, tags = ?, project_id = ?, working_directory = ?, variables = ?, is_pinned = ?, pinned_at = ?
          WHERE id = ?
        `
      )
      .run(
        command.name,
        command.command,
        command.description ?? null,
        command.tags ? JSON.stringify(command.tags) : null,
        command.projectId ?? null,
        command.workingDirectory ?? null,
        command.variables ? JSON.stringify(command.variables) : null,
        command.isPinned ? 1 : 0,
        command.pinnedAt ?? null,
        command.id
      )
    return result.changes > 0
  })
}

export async function removeCommand(commandId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM commands WHERE id = ?').run(commandId)
  })
}

export async function listCommands(): Promise<Command[]> {
  return withSqlTiming('listCommands', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at FROM commands ORDER BY rowid ASC')
      .all() as Array<{
      id: string
      name: string
      command: string
      description: string | null
      tags: string | null
      project_id: string | null
      working_directory: string | null
      variables: string | null
      is_pinned: number
      pinned_at: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      command: row.command,
      description: row.description ?? undefined,
      tags: parseJsonArray(row.tags),
      projectId: row.project_id ?? undefined,
      workingDirectory: row.working_directory ?? undefined,
      variables: parseVariables(row.variables),
      isPinned: parseBoolean(row.is_pinned),
      pinnedAt: row.pinned_at ?? undefined,
    }))
  })
}

export async function getCommandById(commandId: string): Promise<Command | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT id, name, command, description, tags, project_id, working_directory, variables, is_pinned, pinned_at FROM commands WHERE id = ?')
    .get(commandId) as {
    id: string
    name: string
    command: string
    description: string | null
    tags: string | null
    project_id: string | null
    working_directory: string | null
    variables: string | null
    is_pinned: number
    pinned_at: string | null
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    command: row.command,
    description: row.description ?? undefined,
    tags: parseJsonArray(row.tags),
    projectId: row.project_id ?? undefined,
    workingDirectory: row.working_directory ?? undefined,
    variables: parseVariables(row.variables),
    isPinned: parseBoolean(row.is_pinned),
    pinnedAt: row.pinned_at ?? undefined,
  }
}

export async function toggleCommandPin(commandId: string): Promise<Command | null> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const row = database
      .prepare('SELECT is_pinned, pinned_at FROM commands WHERE id = ?')
      .get(commandId) as { is_pinned: number; pinned_at: string | null } | undefined

    if (!row) {
      return null
    }

    const isCurrentlyPinned = parseBoolean(row.is_pinned)
    const newPinnedState = !isCurrentlyPinned
    const newPinnedAt = newPinnedState ? new Date().toISOString() : null

    database
      .prepare('UPDATE commands SET is_pinned = ?, pinned_at = ? WHERE id = ?')
      .run(newPinnedState ? 1 : 0, newPinnedAt, commandId)

    return getCommandById(commandId)
  })
}
