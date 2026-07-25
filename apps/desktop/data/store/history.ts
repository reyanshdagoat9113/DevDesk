import type { RunHistoryEntry, RunStatus } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'

export async function reconcileRunHistory(): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(`
        UPDATE run_history
        SET status = 'stopped', end_time = COALESCE(end_time, ?)
        WHERE status = 'running'
      `)
      .run(new Date().toISOString())
  })
}

export async function createRunHistoryEntry(entry: RunHistoryEntry): Promise<void> {
  await queueWrite(async () => withSqlTiming('createRunHistoryEntry', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO run_history (id, command_id, project_id, status, start_time, end_time, output, resolved_command)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        entry.id,
        entry.commandId,
        entry.projectId ?? null,
        entry.status,
        entry.startTime,
        entry.endTime ?? null,
        entry.output ?? null,
        entry.resolvedCommand ?? null
      )
  }))
}

export async function finalizeRunHistoryEntry(runId: string, output: string, status?: RunStatus): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    if (status) {
      getDbOrThrow()
        .prepare('UPDATE run_history SET output = ?, status = ?, end_time = ? WHERE id = ?')
        .run(output, status, new Date().toISOString(), runId)
    } else {
      getDbOrThrow().prepare('UPDATE run_history SET output = ? WHERE id = ?').run(output, runId)
    }
  })
}

export async function clearRunHistoryInStore(): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM run_history').run()
  })
}

export async function removeRunHistoryEntry(runId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM run_history WHERE id = ?').run(runId)
  })
}

export async function getRunHistoryOutputById(runId: string): Promise<string> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare('SELECT output FROM run_history WHERE id = ?')
    .get(runId) as { output: string | null } | undefined
  return row?.output ?? ''
}

export async function listRecentRunHistory(limit: number): Promise<Array<Omit<RunHistoryEntry, 'output'>>> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT id, command_id, project_id, status, start_time, end_time, resolved_command
        FROM run_history
        ORDER BY start_time DESC, rowid DESC
        LIMIT ?
      `
    )
    .all(limit) as Array<{
    id: string
    command_id: string
    project_id: string | null
    status: RunStatus
    start_time: string
    end_time: string | null
    resolved_command: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    commandId: row.command_id,
    projectId: row.project_id ?? undefined,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    resolvedCommand: row.resolved_command ?? undefined,
  }))
}

export async function listRecentRunHistoryForProject(
  projectId: string,
  limit: number,
): Promise<Array<Omit<RunHistoryEntry, 'output'>>> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT id, command_id, project_id, status, start_time, end_time, resolved_command
        FROM run_history
        WHERE project_id = ?
        ORDER BY start_time DESC, rowid DESC
        LIMIT ?
      `,
    )
    .all(projectId, limit) as Array<{
    id: string
    command_id: string
    project_id: string | null
    status: RunStatus
    start_time: string
    end_time: string | null
    resolved_command: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    commandId: row.command_id,
    projectId: row.project_id ?? undefined,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    resolvedCommand: row.resolved_command ?? undefined,
  }))
}

export async function listRunHistory(): Promise<RunHistoryEntry[]> {
  return withSqlTiming('listRunHistory', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare('SELECT id, command_id, project_id, status, start_time, end_time, output, resolved_command FROM run_history ORDER BY start_time DESC, rowid DESC')
      .all() as Array<{
      id: string
      command_id: string
      project_id: string | null
      status: RunStatus
      start_time: string
      end_time: string | null
      output: string | null
      resolved_command: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      commandId: row.command_id,
      projectId: row.project_id ?? undefined,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      output: row.output ?? undefined,
      resolvedCommand: row.resolved_command ?? undefined,
    }))
  })
}
