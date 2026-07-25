import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS health_check_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    overall_status TEXT NOT NULL,
    summary_json TEXT
  );
  CREATE TABLE IF NOT EXISTS health_check_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    details_json TEXT,
    suggested_fix TEXT,
    FOREIGN KEY (run_id) REFERENCES health_check_runs(id) ON DELETE CASCADE
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

// Dynamic import after mock is established
async function importHealth() {
  return import('../store/health')
}

describe('health store', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.pragma('foreign_keys = ON')
    testDb.exec(SCHEMA)
  })

  describe('createHealthCheckRun', () => {
    it('creates a run with items and returns the full object', async () => {
      const { createHealthCheckRun } = await importHealth()

      const run = await createHealthCheckRun('project-1', [
        {
          category: 'system',
          key: 'node',
          label: 'Node.js installed',
          status: 'pass',
          message: 'v20.11.0',
          detailsJson: '{"version":"20.11.0"}',
          suggestedFix: '',
        },
        {
          category: 'system',
          key: 'git',
          label: 'Git installed',
          status: 'pass',
          message: 'git version 2.43.0',
          detailsJson: '{"version":"2.43.0"}',
          suggestedFix: '',
        },
        {
          category: 'project',
          key: 'env-files',
          label: '.env file present',
          status: 'fail',
          message: '.env file not found',
          detailsJson: '{}',
          suggestedFix: 'Create a .env file in the project root.',
        },
      ])

      expect(run.id).toBeTruthy()
      expect(run.projectId).toBe('project-1')
      expect(run.startedAt).toBeTruthy()
      expect(run.finishedAt).toBeUndefined()
      expect(run.overallStatus).toBe('fail') // one item failed
      expect(run.items).toHaveLength(3)

      // Verify items are populated with IDs and runId
      for (const item of run.items) {
        expect(item.id).toBeTruthy()
        expect(item.runId).toBe(run.id)
      }

      // Verify persisted in the database
      const dbRun = testDb.prepare('SELECT * FROM health_check_runs WHERE id = ?').get(run.id) as any
      expect(dbRun).toBeTruthy()
      expect(dbRun.project_id).toBe('project-1')
      expect(dbRun.overall_status).toBe('fail')

      const dbItems = testDb.prepare('SELECT * FROM health_check_items WHERE run_id = ?').all(run.id) as any[]
      expect(dbItems).toHaveLength(3)
    })

    it('computes overall_status as pass when all items pass', async () => {
      const { createHealthCheckRun } = await importHealth()

      const run = await createHealthCheckRun('project-1', [
        { category: 'system', key: 'node', label: 'Node', status: 'pass', message: 'ok', detailsJson: '{}', suggestedFix: '' },
      ])

      expect(run.overallStatus).toBe('pass')
    })

    it('computes overall_status as warning when any item is warning (no fails)', async () => {
      const { createHealthCheckRun } = await importHealth()

      const run = await createHealthCheckRun('project-1', [
        { category: 'system', key: 'node', label: 'Node', status: 'pass', message: 'ok', detailsJson: '{}', suggestedFix: '' },
        { category: 'system', key: 'docker', label: 'Docker', status: 'warning', message: 'not running', detailsJson: '{}', suggestedFix: 'Start Docker' },
      ])

      expect(run.overallStatus).toBe('warning')
    })

    it('handles empty items array', async () => {
      const { createHealthCheckRun } = await importHealth()

      const run = await createHealthCheckRun('project-1', [])

      expect(run.items).toHaveLength(0)
      expect(run.overallStatus).toBe('pass')
    })

    it('builds summary_json with category counts', async () => {
      const { createHealthCheckRun } = await importHealth()

      const run = await createHealthCheckRun('project-1', [
        { category: 'system', key: 'node', label: 'Node', status: 'pass', message: 'ok', detailsJson: '{}', suggestedFix: '' },
        { category: 'system', key: 'git', label: 'Git', status: 'fail', message: 'missing', detailsJson: '{}', suggestedFix: '' },
        { category: 'project', key: 'env', label: 'Env', status: 'warning', message: 'partial', detailsJson: '{}', suggestedFix: '' },
        { category: 'project', key: 'deps', label: 'Deps', status: 'skipped', message: 'n/a', detailsJson: '{}', suggestedFix: '' },
      ])

      const summary = JSON.parse(run.summaryJson)
      expect(summary.system).toEqual({ pass: 1, warning: 0, fail: 1, skipped: 0 })
      expect(summary.project).toEqual({ pass: 0, warning: 1, fail: 0, skipped: 1 })
    })
  })

  describe('getLatestHealthCheckForProject', () => {
    it('returns null when no runs exist', async () => {
      const { getLatestHealthCheckForProject } = await importHealth()

      const result = await getLatestHealthCheckForProject('nonexistent')
      expect(result).toBeNull()
    })

    it('returns the most recent run with all items', async () => {
      const { createHealthCheckRun, getLatestHealthCheckForProject } = await importHealth()

      // Create an older run
      await createHealthCheckRun('project-1', [
        { category: 'system', key: 'old', label: 'Old', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      // Wait a tick to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Create a newer run
      const newer = await createHealthCheckRun('project-1', [
        { category: 'system', key: 'new', label: 'New', status: 'fail', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      const latest = await getLatestHealthCheckForProject('project-1')
      expect(latest).toBeTruthy()
      expect(latest!.id).toBe(newer.id)
      expect(latest!.items).toHaveLength(1)
      expect(latest!.items[0].key).toBe('new')
    })
  })

  describe('listHealthCheckRuns', () => {
    it('returns empty array when no runs exist', async () => {
      const { listHealthCheckRuns } = await importHealth()

      const result = await listHealthCheckRuns('nonexistent')
      expect(result).toEqual([])
    })

    it('returns runs in descending order (most recent first)', async () => {
      const { createHealthCheckRun, listHealthCheckRuns } = await importHealth()

      await createHealthCheckRun('project-1', [
        { category: 'system', key: 'first', label: 'First', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      await new Promise((resolve) => setTimeout(resolve, 10))

      await createHealthCheckRun('project-1', [
        { category: 'system', key: 'second', label: 'Second', status: 'fail', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      const runs = await listHealthCheckRuns('project-1')
      expect(runs).toHaveLength(2)
      expect(runs[0].overallStatus).toBe('fail') // most recent first
      expect(runs[1].overallStatus).toBe('pass')
    })

    it('respects the limit parameter', async () => {
      const { createHealthCheckRun, listHealthCheckRuns } = await importHealth()

      for (let i = 0; i < 5; i++) {
        await createHealthCheckRun('project-1', [
          { category: 'system', key: `check-${i}`, label: `Check ${i}`, status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
        ])
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      const runs = await listHealthCheckRuns('project-1', 2)
      expect(runs).toHaveLength(2)
    })

    it('returns runs scoped to the correct project', async () => {
      const { createHealthCheckRun, listHealthCheckRuns } = await importHealth()

      await createHealthCheckRun('project-a', [
        { category: 'system', key: 'a', label: 'A', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])
      await createHealthCheckRun('project-b', [
        { category: 'system', key: 'b', label: 'B', status: 'fail', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      const runsA = await listHealthCheckRuns('project-a')
      expect(runsA).toHaveLength(1)
      expect(runsA[0].projectId).toBe('project-a')

      const runsB = await listHealthCheckRuns('project-b')
      expect(runsB).toHaveLength(1)
      expect(runsB[0].projectId).toBe('project-b')
    })
  })

  describe('cleanupOldHealthChecks', () => {
    it('keeps the latest N runs for a project', async () => {
      const { createHealthCheckRun, cleanupOldHealthChecks, listHealthCheckRuns } = await importHealth()

      // Create 5 runs
      for (let i = 0; i < 5; i++) {
        await createHealthCheckRun('project-1', [
          { category: 'system', key: `check-${i}`, label: `Check ${i}`, status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
        ])
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      // Keep only the latest 2
      await cleanupOldHealthChecks('project-1', 2)

      const runs = await listHealthCheckRuns('project-1')
      expect(runs).toHaveLength(2)
    })

    it('cascade-deletes orphaned items', async () => {
      const { createHealthCheckRun, cleanupOldHealthChecks } = await importHealth()

      const run = await createHealthCheckRun('project-1', [
        { category: 'system', key: 'node', label: 'Node', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      // Verify items exist before cleanup
      let itemCount = testDb.prepare('SELECT COUNT(*) as count FROM health_check_items').get() as { count: number }
      expect(itemCount.count).toBe(1)

      // Clean up all but 0 = delete everything
      await cleanupOldHealthChecks('project-1', 0)

      itemCount = testDb.prepare('SELECT COUNT(*) as count FROM health_check_items').get() as { count: number }
      expect(itemCount.count).toBe(0)

      const runCount = testDb.prepare('SELECT COUNT(*) as count FROM health_check_runs').get() as { count: number }
      expect(runCount.count).toBe(0)
    })

    it('does not delete runs from other projects', async () => {
      const { createHealthCheckRun, cleanupOldHealthChecks, listHealthCheckRuns } = await importHealth()

      await createHealthCheckRun('project-a', [
        { category: 'system', key: 'a', label: 'A', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])
      await createHealthCheckRun('project-a', [
        { category: 'system', key: 'a2', label: 'A2', status: 'pass', message: '', detailsJson: '{}', suggestedFix: '' },
      ])
      await createHealthCheckRun('project-b', [
        { category: 'system', key: 'b', label: 'B', status: 'fail', message: '', detailsJson: '{}', suggestedFix: '' },
      ])

      // Clean up project-a keeping only 1
      await cleanupOldHealthChecks('project-a', 1)

      const runsA = await listHealthCheckRuns('project-a')
      expect(runsA).toHaveLength(1)

      const runsB = await listHealthCheckRuns('project-b')
      expect(runsB).toHaveLength(1) // unaffected
    })
  })
})
