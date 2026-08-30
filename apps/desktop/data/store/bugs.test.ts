import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => '/mock/user/data',
  },
}))

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT NOT NULL,
    linked_container_names TEXT NOT NULL DEFAULT '[]',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    pinned_at TEXT
  );

  CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, project_id TEXT);
  CREATE TABLE IF NOT EXISTS chains (id TEXT PRIMARY KEY, project_id TEXT);
  CREATE TABLE IF NOT EXISTS triggers (id TEXT PRIMARY KEY, project_id TEXT);
  CREATE TABLE IF NOT EXISTS run_history (id TEXT PRIMARY KEY, project_id TEXT);
  CREATE TABLE IF NOT EXISTS notes (project_id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS engine_indexes (project_id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS engine_search_sessions (project_id TEXT PRIMARY KEY);

  CREATE TABLE IF NOT EXISTS bug_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    expected_result TEXT,
    actual_result TEXT,
    reproduction_steps TEXT,
    notes TEXT,
    resolution_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`

let testDb: Database.Database

vi.mock('../store/core', () => ({
  ensureDbInitialized: vi.fn(async () => {
    /* in-memory DB already created in beforeEach */
  }),
  getDbOrThrow: () => testDb,
  queueWrite: (fn: () => unknown) => Promise.resolve().then(() => fn()),
  withSqlTiming: (_label: string, fn: () => unknown) => fn(),
}))

async function importBugs() {
  return import('../store/bugs')
}

async function importProjects() {
  return import('../store/projects')
}

function insertProject(id: string) {
  testDb
    .prepare(
      `
        INSERT INTO projects (id, path, name, type, icon, linked_container_names)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, `/tmp/${id}`, id, 'node', 'box', '[]')
}

describe('bug store', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.pragma('foreign_keys = ON')
    testDb.exec(SCHEMA)
    insertProject('project-1')
    insertProject('project-2')
  })

  it('creates a bug report with defaults', async () => {
    const { createBugReport, getBugReportById } = await importBugs()

    const report = await createBugReport({
      projectId: 'project-1',
      title: ' Broken button ',
    })

    expect(report.id).toBeTruthy()
    expect(report.projectId).toBe('project-1')
    expect(report.title).toBe('Broken button')
    expect(report.severity).toBe('medium')
    expect(report.status).toBe('open')
    expect(report.createdAt).toBeTruthy()
    expect(report.updatedAt).toBe(report.createdAt)
    expect(report.resolvedAt).toBeUndefined()

    await expect(getBugReportById(report.id)).resolves.toEqual(report)
  })

  it('lists reports scoped to project, status, and severity', async () => {
    const { createBugReport, listBugReports } = await importBugs()

    const first = await createBugReport({
      projectId: 'project-1',
      title: 'First',
      severity: 'high',
      status: 'open',
    })
    await createBugReport({
      projectId: 'project-1',
      title: 'Second',
      severity: 'low',
      status: 'closed',
    })
    await createBugReport({
      projectId: 'project-2',
      title: 'Third',
      severity: 'high',
      status: 'open',
    })

    expect(await listBugReports({ projectId: 'project-1' })).toHaveLength(2)
    expect(await listBugReports({ projectId: 'project-1', status: 'open' })).toEqual([first])
    expect(await listBugReports({ projectId: 'project-1', severity: 'high' })).toEqual([first])
  })

  it('updates fields and resolves timestamps when status changes', async () => {
    const { createBugReport, updateBugReport } = await importBugs()

    const report = await createBugReport({ projectId: 'project-1', title: 'Old title' })
    await new Promise((resolve) => setTimeout(resolve, 5))

    const resolved = await updateBugReport(report.id, {
      title: 'New title',
      status: 'resolved',
      severity: 'critical',
      resolutionNotes: 'Fixed in main',
    })

    expect(resolved).toMatchObject({
      id: report.id,
      title: 'New title',
      status: 'resolved',
      severity: 'critical',
      resolutionNotes: 'Fixed in main',
    })
    expect(resolved?.updatedAt).not.toBe(report.updatedAt)
    expect(resolved?.resolvedAt).toBeTruthy()

    const reopened = await updateBugReport(report.id, { status: 'open' })
    expect(reopened?.status).toBe('open')
    expect(reopened?.resolvedAt).toBeUndefined()
  })

  it('returns null when updating or fetching a missing report', async () => {
    const { getBugReportById, updateBugReport } = await importBugs()

    await expect(getBugReportById('missing')).resolves.toBeNull()
    await expect(updateBugReport('missing', { title: 'Nope' })).resolves.toBeNull()
  })

  it('deletes a bug report', async () => {
    const { createBugReport, deleteBugReport, getBugReportById } = await importBugs()

    const report = await createBugReport({ projectId: 'project-1', title: 'Delete me' })

    await expect(deleteBugReport(report.id)).resolves.toBe(true)
    await expect(deleteBugReport(report.id)).resolves.toBe(false)
    await expect(getBugReportById(report.id)).resolves.toBeNull()
  })

  it('paginates reports with limit and offset', async () => {
    const { createBugReport, listBugReports } = await importBugs()

    const first = await createBugReport({ projectId: 'project-1', title: 'One' })
    const second = await createBugReport({ projectId: 'project-1', title: 'Two' })
    const third = await createBugReport({ projectId: 'project-1', title: 'Three' })

    const page = await listBugReports({ projectId: 'project-1', limit: 2, offset: 0 })
    expect(page).toHaveLength(2)
    expect(page.map((report) => report.id)).toEqual([third.id, second.id])

    const nextPage = await listBugReports({ projectId: 'project-1', limit: 2, offset: 2 })
    expect(nextPage).toHaveLength(1)
    expect(nextPage.map((report) => report.id)).toEqual([first.id])
  })

  it('removes project-owned bug reports when a project is removed', async () => {
    const { createBugReport, listBugReports } = await importBugs()
    const { removeProject } = await importProjects()

    await createBugReport({ projectId: 'project-1', title: 'Project bug' })
    const other = await createBugReport({ projectId: 'project-2', title: 'Other bug' })

    await removeProject('project-1')

    expect(await listBugReports({ projectId: 'project-1' })).toEqual([])
    expect(await listBugReports({ projectId: 'project-2' })).toEqual([other])
  })
})
