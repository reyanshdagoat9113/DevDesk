import { randomUUID } from 'node:crypto'

import type { HealthCheckItem, HealthCheckItemStatus, HealthCheckRun, HealthCheckRunStatus } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite } from './core'

type HealthCheckRunRow = {
  id: string
  project_id: string
  started_at: string
  finished_at: string | null
  overall_status: string
  summary_json: string | null
}

type HealthCheckItemRow = {
  id: string
  run_id: string
  category: string
  key: string
  label: string
  status: string
  message: string | null
  details_json: string | null
  suggested_fix: string | null
}

function toItem(row: HealthCheckItemRow): HealthCheckItem {
  return {
    id: row.id,
    runId: row.run_id,
    category: row.category,
    key: row.key,
    label: row.label,
    status: row.status as HealthCheckItemStatus,
    message: row.message ?? '',
    detailsJson: row.details_json ?? '{}',
    suggestedFix: row.suggested_fix ?? '',
  }
}

function toRun(row: HealthCheckRunRow, items: HealthCheckItem[]): HealthCheckRun {
  return {
    id: row.id,
    projectId: row.project_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    overallStatus: row.overall_status as HealthCheckRunStatus,
    summaryJson: row.summary_json ?? '{}',
    items,
  }
}

function computeOverallStatus(items: Pick<HealthCheckItem, 'status'>[]): HealthCheckRunStatus {
  if (items.some((item) => item.status === 'fail')) return 'fail'
  if (items.some((item) => item.status === 'warning')) return 'warning'
  return 'pass'
}

function buildSummaryJson(items: Pick<HealthCheckItem, 'category' | 'status'>[]): string {
  const categories = new Map<string, { pass: number; warning: number; fail: number; skipped: number }>()

  for (const item of items) {
    if (!categories.has(item.category)) {
      categories.set(item.category, { pass: 0, warning: 0, fail: 0, skipped: 0 })
    }
    const counts = categories.get(item.category)!
    if (item.status === 'pass') counts.pass += 1
    else if (item.status === 'warning') counts.warning += 1
    else if (item.status === 'fail') counts.fail += 1
    else if (item.status === 'skipped') counts.skipped += 1
  }

  const summary: Record<string, { pass: number; warning: number; fail: number; skipped: number }> = {}
  for (const [category, counts] of categories) {
    summary[category] = counts
  }

  return JSON.stringify(summary)
}

/**
 * Creates a new health check run with all items in a single transaction.
 * Returns the fully populated HealthCheckRun.
 */
export async function createHealthCheckRun(
  projectId: string,
  items: Omit<HealthCheckItem, 'id' | 'runId'>[],
): Promise<HealthCheckRun> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const db = getDbOrThrow()

    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    const overallStatus = computeOverallStatus(items)
    const summaryJson = buildSummaryJson(items)

    const insertRun = db.prepare(`
      INSERT INTO health_check_runs (id, project_id, started_at, finished_at, overall_status, summary_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertItem = db.prepare(`
      INSERT INTO health_check_items (id, run_id, category, key, label, status, message, details_json, suggested_fix)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const populatedItems: HealthCheckItem[] = items.map((item) => ({
      id: randomUUID(),
      runId,
      ...item,
    }))

    const transaction = db.transaction(() => {
      insertRun.run(runId, projectId, startedAt, null, overallStatus, summaryJson)

      for (const item of populatedItems) {
        insertItem.run(
          item.id,
          runId,
          item.category,
          item.key,
          item.label,
          item.status,
          item.message || null,
          item.detailsJson || null,
          item.suggestedFix || null,
        )
      }
    })

    transaction()

    return {
      id: runId,
      projectId,
      startedAt,
      finishedAt: undefined,
      overallStatus,
      summaryJson,
      items: populatedItems,
    }
  })
}

/**
 * Returns the most recent health check run for a project, or null if none exist.
 * Includes all check items.
 */
export async function getLatestHealthCheckForProject(projectId: string): Promise<HealthCheckRun | null> {
  await ensureDbInitialized()
  const db = getDbOrThrow()

  const runRow = db
    .prepare(
      `
        SELECT id, project_id, started_at, finished_at, overall_status, summary_json
        FROM health_check_runs
        WHERE project_id = ?
        ORDER BY started_at DESC
        LIMIT 1
      `,
    )
    .get(projectId) as HealthCheckRunRow | undefined

  if (!runRow) return null

  const itemRows = db
    .prepare(
      `
        SELECT id, run_id, category, key, label, status, message, details_json, suggested_fix
        FROM health_check_items
        WHERE run_id = ?
        ORDER BY category, key
      `,
    )
    .all(runRow.id) as HealthCheckItemRow[]

  const items = itemRows.map(toItem)
  return toRun(runRow, items)
}

/**
 * Lists historical health check runs for a project (without items).
 * Most recent runs first.
 */
export async function listHealthCheckRuns(
  projectId: string,
  limit: number = 20,
): Promise<Omit<HealthCheckRun, 'items'>[]> {
  await ensureDbInitialized()
  const db = getDbOrThrow()

  const rows = db
    .prepare(
      `
        SELECT id, project_id, started_at, finished_at, overall_status, summary_json
        FROM health_check_runs
        WHERE project_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `,
    )
    .all(projectId, limit) as HealthCheckRunRow[]

  return rows.map((row) => toRun(row, []))
}

/**
 * Deletes all but the latest N health check runs for a project.
 * Items are cascade-deleted via the foreign key constraint.
 */
export async function cleanupOldHealthChecks(projectId: string, keep: number = 50): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const db = getDbOrThrow()

    db.prepare(
      `
        DELETE FROM health_check_runs
        WHERE project_id = ?
        AND id NOT IN (
          SELECT id FROM health_check_runs
          WHERE project_id = ?
          ORDER BY started_at DESC
          LIMIT ?
        )
      `,
    ).run(projectId, projectId, keep)
  })
}
