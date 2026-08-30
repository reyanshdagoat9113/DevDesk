import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS run_history (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    project_id TEXT,
    status TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    output TEXT,
    resolved_command TEXT
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

async function importHistory() {
  return import('../store/history')
}

async function insertRun(id: string, startTime: string, output = '') {
  const { createRunHistoryEntry } = await importHistory()
  await createRunHistoryEntry({
    id,
    commandId: 'cmd-1',
    projectId: 'project-1',
    status: 'success',
    startTime,
    endTime: startTime,
    output,
    resolvedCommand: 'echo ok',
  })
}

describe('run history store', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')
    testDb.exec(SCHEMA)
  })

  it('omits output from listRunHistory even when the row stores a large output string', async () => {
    const { listRunHistory } = await importHistory()
    const largeOutput = 'x'.repeat(10_000)

    await insertRun('run-1', '2026-08-07T10:00:00.000Z', largeOutput)

    const entries = await listRunHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('run-1')
    expect(entries[0]).not.toHaveProperty('output')
  })

  it('caps the default list when an explicit limit is provided', async () => {
    const { listRunHistory } = await importHistory()

    await insertRun('run-1', '2026-08-07T10:00:00.000Z')
    await insertRun('run-2', '2026-08-07T11:00:00.000Z')
    await insertRun('run-3', '2026-08-07T12:00:00.000Z')

    const entries = await listRunHistory({ limit: 2 })
    expect(entries).toHaveLength(2)
  })

  it('paginates remaining rows in start_time DESC order', async () => {
    const { listRunHistory } = await importHistory()

    await insertRun('run-1', '2026-08-07T10:00:00.000Z')
    await insertRun('run-2', '2026-08-07T11:00:00.000Z')
    await insertRun('run-3', '2026-08-07T12:00:00.000Z')

    const firstPage = await listRunHistory({ limit: 2, offset: 0 })
    expect(firstPage.map((entry) => entry.id)).toEqual(['run-3', 'run-2'])

    const secondPage = await listRunHistory({ limit: 2, offset: 2 })
    expect(secondPage.map((entry) => entry.id)).toEqual(['run-1'])
  })

  it('returns the full total from countRunHistory regardless of list limit', async () => {
    const { listRunHistory, countRunHistory } = await importHistory()

    await insertRun('run-1', '2026-08-07T10:00:00.000Z')
    await insertRun('run-2', '2026-08-07T11:00:00.000Z')
    await insertRun('run-3', '2026-08-07T12:00:00.000Z')

    expect(await listRunHistory({ limit: 2 })).toHaveLength(2)
    expect(await countRunHistory()).toBe(3)
  })

  it('returns full stored output on demand via getRunHistoryOutputById', async () => {
    const { getRunHistoryOutputById } = await importHistory()
    const output = 'full captured output\nline 2'

    await insertRun('run-1', '2026-08-07T10:00:00.000Z', output)

    await expect(getRunHistoryOutputById('run-1')).resolves.toBe(output)
  })
})
