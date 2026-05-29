import { randomUUID } from 'node:crypto'
import path from 'node:path'

import type { AddBugAttachmentInput, BugAttachment, BugAttachmentKind, BugContextSnapshot, BugContextSnapshotData, BugReport, BugReportFilters, BugSeverity, BugStatus, CreateBugReportInput, UpdateBugReportInput } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'

const VALID_BUG_SEVERITIES = new Set<BugSeverity>(['low', 'medium', 'high', 'critical'])
const VALID_BUG_STATUSES = new Set<BugStatus>(['open', 'in_progress', 'resolved', 'closed'])

type BugReportRow = {
  id: string
  project_id: string
  title: string
  severity: string
  status: string
  expected_result: string | null
  actual_result: string | null
  reproduction_steps: string | null
  notes: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

function normalizeSeverity(value: BugSeverity | undefined): BugSeverity {
  return value && VALID_BUG_SEVERITIES.has(value) ? value : 'medium'
}

function normalizeStatus(value: BugStatus | undefined): BugStatus {
  return value && VALID_BUG_STATUSES.has(value) ? value : 'open'
}

function optionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toBugReport(row: BugReportRow): BugReport {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    severity: normalizeSeverity(row.severity as BugSeverity),
    status: normalizeStatus(row.status as BugStatus),
    expectedResult: row.expected_result ?? undefined,
    actualResult: row.actual_result ?? undefined,
    reproductionSteps: row.reproduction_steps ?? undefined,
    notes: row.notes ?? undefined,
    resolutionNotes: row.resolution_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

function selectBugReportById(id: string): BugReport | null {
  const row = getDbOrThrow()
    .prepare(
      `
        SELECT
          id,
          project_id,
          title,
          severity,
          status,
          expected_result,
          actual_result,
          reproduction_steps,
          notes,
          resolution_notes,
          created_at,
          updated_at,
          resolved_at
        FROM bug_reports
        WHERE id = ?
      `
    )
    .get(id) as BugReportRow | undefined

  return row ? toBugReport(row) : null
}

export async function createBugReport(input: CreateBugReportInput): Promise<BugReport> {
  return queueWrite(async () => withSqlTiming('createBugReport', async () => {
    await ensureDbInitialized()

    const projectId = input.projectId.trim()
    const title = input.title.trim()

    if (!projectId) {
      throw new Error('Bug report projectId is required.')
    }

    if (!title) {
      throw new Error('Bug report title is required.')
    }

    const now = new Date().toISOString()
    const status = normalizeStatus(input.status)
    const resolvedAt = status === 'resolved' ? now : null
    const report: BugReport = {
      id: randomUUID(),
      projectId,
      title,
      severity: normalizeSeverity(input.severity),
      status,
      expectedResult: optionalText(input.expectedResult) ?? undefined,
      actualResult: optionalText(input.actualResult) ?? undefined,
      reproductionSteps: optionalText(input.reproductionSteps) ?? undefined,
      notes: optionalText(input.notes) ?? undefined,
      resolutionNotes: optionalText(input.resolutionNotes) ?? undefined,
      createdAt: now,
      updatedAt: now,
      resolvedAt: resolvedAt ?? undefined,
    }

    getDbOrThrow()
      .prepare(
        `
          INSERT INTO bug_reports (
            id,
            project_id,
            title,
            severity,
            status,
            expected_result,
            actual_result,
            reproduction_steps,
            notes,
            resolution_notes,
            created_at,
            updated_at,
            resolved_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        report.id,
        report.projectId,
        report.title,
        report.severity,
        report.status,
        report.expectedResult ?? null,
        report.actualResult ?? null,
        report.reproductionSteps ?? null,
        report.notes ?? null,
        report.resolutionNotes ?? null,
        report.createdAt,
        report.updatedAt,
        report.resolvedAt ?? null
      )

    return report
  }))
}

export async function getBugReportById(id: string): Promise<BugReport | null> {
  await ensureDbInitialized()
  return selectBugReportById(id)
}

export async function updateBugReport(id: string, updates: UpdateBugReportInput): Promise<BugReport | null> {
  return queueWrite(async () => withSqlTiming('updateBugReport', async () => {
    await ensureDbInitialized()
    const existing = selectBugReportById(id)

    if (!existing) {
      return null
    }

    const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title
    if (!nextTitle) {
      throw new Error('Bug report title is required.')
    }

    const now = new Date().toISOString()
    const nextStatus = updates.status !== undefined ? normalizeStatus(updates.status) : existing.status
    const nextResolvedAt =
      nextStatus === 'resolved'
        ? existing.resolvedAt ?? now
        : null

    getDbOrThrow()
      .prepare(
        `
          UPDATE bug_reports
          SET
            title = ?,
            severity = ?,
            status = ?,
            expected_result = ?,
            actual_result = ?,
            reproduction_steps = ?,
            notes = ?,
            resolution_notes = ?,
            updated_at = ?,
            resolved_at = ?
          WHERE id = ?
        `
      )
      .run(
        nextTitle,
        updates.severity !== undefined ? normalizeSeverity(updates.severity) : existing.severity,
        nextStatus,
        updates.expectedResult !== undefined ? optionalText(updates.expectedResult) : existing.expectedResult ?? null,
        updates.actualResult !== undefined ? optionalText(updates.actualResult) : existing.actualResult ?? null,
        updates.reproductionSteps !== undefined ? optionalText(updates.reproductionSteps) : existing.reproductionSteps ?? null,
        updates.notes !== undefined ? optionalText(updates.notes) : existing.notes ?? null,
        updates.resolutionNotes !== undefined ? optionalText(updates.resolutionNotes) : existing.resolutionNotes ?? null,
        now,
        nextResolvedAt,
        id
      )

    return selectBugReportById(id)
  }))
}

export async function deleteBugReport(id: string): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow().prepare('DELETE FROM bug_reports WHERE id = ?').run(id)
    return result.changes > 0
  })
}

export async function listBugReports(filters: BugReportFilters = {}): Promise<BugReport[]> {
  return withSqlTiming('listBugReports', async () => {
    await ensureDbInitialized()

    const where: string[] = []
    const params: string[] = []

    if (filters.projectId) {
      where.push('project_id = ?')
      params.push(filters.projectId)
    }

    if (filters.status) {
      where.push('status = ?')
      params.push(filters.status)
    }

    if (filters.severity) {
      where.push('severity = ?')
      params.push(filters.severity)
    }

    const sql = `
      SELECT
        id,
        project_id,
        title,
        severity,
        status,
        expected_result,
        actual_result,
        reproduction_steps,
        notes,
        resolution_notes,
        created_at,
        updated_at,
        resolved_at
      FROM bug_reports
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, rowid DESC
    `

    const rows = getDbOrThrow().prepare(sql).all(...params) as BugReportRow[]
    return rows.map(toBugReport)
  })
}

type BugContextSnapshotRow = {
  id: string
  bug_report_id: string
  command_history_json: string | null
  run_history_json: string | null
  logs_json: string | null
  environment_snapshot_json: string | null
  active_container_state_json: string | null
  health_snapshot_json: string | null
  notes_snippet_json: string | null
}

function toBugContextSnapshot(row: BugContextSnapshotRow): BugContextSnapshot {
  return {
    id: row.id,
    bugReportId: row.bug_report_id,
    commandHistoryJson: row.command_history_json ?? '[]',
    runHistoryJson: row.run_history_json ?? '[]',
    logsJson: row.logs_json ?? '[]',
    environmentSnapshotJson: row.environment_snapshot_json ?? '{}',
    activeContainerStateJson: row.active_container_state_json ?? '[]',
    healthSnapshotJson: row.health_snapshot_json ?? '{}',
    notesSnippetJson: row.notes_snippet_json ?? '{}',
  }
}

export async function saveBugContextSnapshot(
  bugReportId: string,
  data: BugContextSnapshotData,
): Promise<BugContextSnapshot> {
  return queueWrite(async () => {
    await ensureDbInitialized()

    const id = randomUUID()

    getDbOrThrow()
      .prepare(
        `
          INSERT INTO bug_context_snapshots (
            id,
            bug_report_id,
            command_history_json,
            run_history_json,
            logs_json,
            environment_snapshot_json,
            active_container_state_json,
            health_snapshot_json,
            notes_snippet_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        bugReportId,
        data.commandHistoryJson,
        data.runHistoryJson,
        data.logsJson,
        data.environmentSnapshotJson,
        data.activeContainerStateJson,
        data.healthSnapshotJson,
        data.notesSnippetJson,
      )

    return {
      id,
      bugReportId,
      commandHistoryJson: data.commandHistoryJson,
      runHistoryJson: data.runHistoryJson,
      logsJson: data.logsJson,
      environmentSnapshotJson: data.environmentSnapshotJson,
      activeContainerStateJson: data.activeContainerStateJson,
      healthSnapshotJson: data.healthSnapshotJson,
      notesSnippetJson: data.notesSnippetJson,
    }
  })
}

export async function getBugContextSnapshotByBugId(
  bugReportId: string,
): Promise<BugContextSnapshot | null> {
  await ensureDbInitialized()

  const row = getDbOrThrow()
    .prepare(
      `
        SELECT
          id,
          bug_report_id,
          command_history_json,
          run_history_json,
          logs_json,
          environment_snapshot_json,
          active_container_state_json,
          health_snapshot_json,
          notes_snippet_json
        FROM bug_context_snapshots
        WHERE bug_report_id = ?
      `,
    )
    .get(bugReportId) as BugContextSnapshotRow | undefined

  return row ? toBugContextSnapshot(row) : null
}

export async function deleteBugContextSnapshotsByBugId(bugReportId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare('DELETE FROM bug_context_snapshots WHERE bug_report_id = ?')
      .run(bugReportId)
  })
}

type BugAttachmentRow = {
  id: string
  bug_report_id: string
  kind: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

function toBugAttachment(row: BugAttachmentRow): BugAttachment {
  return {
    id: row.id,
    bugReportId: row.bug_report_id,
    kind: row.kind as BugAttachmentKind,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type ?? undefined,
    createdAt: row.created_at,
  }
}

export async function addBugAttachmentRecord(
  input: AddBugAttachmentInput & { storedRelativePath: string; fileSize: number },
): Promise<BugAttachment> {
  return queueWrite(async () => {
    await ensureDbInitialized()

    const id = randomUUID()
    const now = new Date().toISOString()
    const kind = input.kind ?? 'file'

    getDbOrThrow()
      .prepare(
        `
          INSERT INTO bug_attachments (
            id,
            bug_report_id,
            kind,
            file_name,
            file_path,
            file_size,
            mime_type,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.bugReportId,
        kind,
        input.sourceFilePath.split(/[\\/]/).pop() ?? 'unknown',
        input.storedRelativePath,
        input.fileSize,
        input.mimeType ?? null,
        now,
      )

    return {
      id,
      bugReportId: input.bugReportId,
      kind,
      fileName: input.sourceFilePath.split(/[\\/]/).pop() ?? 'unknown',
      filePath: input.storedRelativePath,
      fileSize: input.fileSize,
      mimeType: input.mimeType ?? undefined,
      createdAt: now,
    }
  })
}

export async function getBugAttachmentById(id: string): Promise<BugAttachment | null> {
  await ensureDbInitialized()

  const row = getDbOrThrow()
    .prepare(
      `
        SELECT id, bug_report_id, kind, file_name, file_path, file_size, mime_type, created_at
        FROM bug_attachments
        WHERE id = ?
      `,
    )
    .get(id) as BugAttachmentRow | undefined

  return row ? toBugAttachment(row) : null
}

export async function listBugAttachments(bugReportId: string): Promise<BugAttachment[]> {
  await ensureDbInitialized()

  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT id, bug_report_id, kind, file_name, file_path, file_size, mime_type, created_at
        FROM bug_attachments
        WHERE bug_report_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(bugReportId) as BugAttachmentRow[]

  return rows.map(toBugAttachment)
}

export async function deleteBugAttachmentRecord(id: string): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow().prepare('DELETE FROM bug_attachments WHERE id = ?').run(id)
    return result.changes > 0
  })
}

export async function listBugAttachmentPathsByBugId(bugReportId: string): Promise<string[]> {
  await ensureDbInitialized()

  const rows = getDbOrThrow()
    .prepare('SELECT file_path FROM bug_attachments WHERE bug_report_id = ?')
    .all(bugReportId) as Array<{ file_path: string }>

  return rows.map((row) => row.file_path)
}
