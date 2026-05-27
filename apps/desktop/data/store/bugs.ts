import { randomUUID } from 'node:crypto'

import type { BugReport, BugReportFilters, BugSeverity, BugStatus, CreateBugReportInput, UpdateBugReportInput } from '../model'
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
