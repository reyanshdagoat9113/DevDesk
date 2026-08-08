import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsAccess = vi.fn()
const fsUnlink = vi.fn()

const clearEngineIndexMeta = vi.fn(async () => undefined)
const clearEngineSearchSession = vi.fn(async () => undefined)
const listEngineIndexes = vi.fn(async () => ({}))
const listEngineSearchSessions = vi.fn(async () => ({}))
const upsertEngineIndex = vi.fn(async (value) => value)
const upsertEngineSearchSession = vi.fn(async (value) => value)

const engineIndex = vi.fn()
const engineSearch = vi.fn()
const engineStats = vi.fn()
const engineGit = vi.fn()
const getEngineDbPath = vi.fn((projectId: string) => `/tmp/${projectId}.sqlite`)
const getEngineStatus = vi.fn(async () => ({ available: true, version: 'test-suite' }))

vi.mock('node:fs/promises', () => ({
  default: {
    access: fsAccess,
    unlink: fsUnlink,
  },
}))

vi.mock('../data/store', () => ({
  clearEngineIndexMeta,
  clearEngineSearchSession,
  listEngineIndexes,
  listEngineSearchSessions,
  upsertEngineIndex,
  upsertEngineSearchSession,
}))

vi.mock('./binary', () => ({
  engineGit,
  engineIndex,
  engineSearch,
  engineStats,
  getEngineDbPath,
  getEngineStatus,
}))

describe('engine service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listEngineIndexes.mockResolvedValue({})
    listEngineSearchSessions.mockResolvedValue({})
    getEngineStatus.mockResolvedValue({ available: true, version: 'test-suite' })
    fsAccess.mockRejectedValue(new Error('missing'))
    fsUnlink.mockResolvedValue(undefined)
  })

  it('loads the engine snapshot from store state', async () => {
    listEngineIndexes.mockResolvedValue({ p1: { projectId: 'p1', dbPath: '/tmp/p1.sqlite', lastIndexed: 'now', fileCount: 1 } })
    listEngineSearchSessions.mockResolvedValue({ p1: { projectId: 'p1', query: 'needle', regex: false, updatedAt: 'now', result: { ok: true, query: 'needle', results: [], totalMatches: 0, durationMs: 1 } } })

    const { loadEngineSnapshot } = await import('./engineService')
    const snapshot = await loadEngineSnapshot()

    expect(snapshot.status.available).toBe(true)
    expect(snapshot.indexes.p1.fileCount).toBe(1)
    expect(snapshot.searchSessions.p1.query).toBe('needle')
  })

  it('auto-indexes before search and normalizes result paths', async () => {
    engineIndex.mockResolvedValue({ ok: true, db: '/tmp/p1.sqlite', repo: '/repo', filesIndexed: 2, filesSkipped: 0, durationMs: 10, warnings: [] })
    engineSearch.mockResolvedValue({ ok: true, query: 'needle', results: [{ path: '/repo/src/app.ts', language: 'typescript', score: 1, matches: [] }], totalMatches: 1, durationMs: 4 })

    const { searchProject } = await import('./engineService')
    const result = await searchProject('p1', '/repo', 'needle', { regex: true, limit: 10 })

    expect(engineIndex).toHaveBeenCalledWith('/repo', 'p1', { profile: 'source-first', full: true })
    expect(engineSearch).toHaveBeenCalledWith('p1', 'needle', { regex: true, limit: 10 })
    expect(result.results[0].path).toBe('src/app.ts')
    expect(upsertEngineIndex).toHaveBeenCalled()
    expect(upsertEngineSearchSession).toHaveBeenCalled()
  })

  it('indexes with an explicit profile and persists it on metadata', async () => {
    engineIndex.mockResolvedValue({
      ok: true,
      db: '/tmp/p1.sqlite',
      repo: '/repo',
      filesIndexed: 3,
      filesSkipped: 1,
      durationMs: 12,
      warnings: [],
      profile: 'full-text',
    })

    const { indexProject } = await import('./engineService')
    await indexProject('p1', '/repo', { profile: 'full-text' })

    expect(engineIndex).toHaveBeenCalledWith('/repo', 'p1', { profile: 'full-text', full: true })
    expect(upsertEngineIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        fileCount: 3,
        indexProfile: 'full-text',
      }),
    )
  })

  it('returns stats and backfills missing index metadata from the database', async () => {
    listEngineIndexes.mockResolvedValue({ p1: { projectId: 'p1', dbPath: '/tmp/p1.sqlite', lastIndexed: '', fileCount: 0, indexProfile: 'source-docs' } })
    engineStats.mockResolvedValue({ ok: true, db: '/tmp/p1.sqlite', stats: { totalFiles: 4, totalSizeBytes: 99, byLanguage: { typescript: 4 }, indexedAt: '2026-01-01T00:00:00.000Z' } })

    const { getProjectStats } = await import('./engineService')
    const result = await getProjectStats('p1')

    expect(result?.stats.totalFiles).toBe(4)
    expect(upsertEngineIndex).toHaveBeenCalledWith({
      projectId: 'p1',
      dbPath: '/tmp/p1.sqlite',
      lastIndexed: '2026-01-01T00:00:00.000Z',
      fileCount: 4,
      indexProfile: 'source-docs',
    })
  })

  it('clears project index metadata, search sessions, and db files', async () => {
    const { clearProjectIndex, clearProjectSearchSession, getProjectGitInsights, isEngineAvailable } = await import('./engineService')
    engineGit.mockResolvedValue({ branch: 'main', totalCommits: 1, contributors: [], hotspots: [], recentCommits: [], churnFiles: [], workingTree: { isClean: true, hasStagedChanges: false, hasUnstagedChanges: false, hasUntrackedChanges: false, hasConflicts: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0, ahead: 0, behind: 0, files: [] } })

    await expect(getProjectGitInsights('/repo')).resolves.toMatchObject({ branch: 'main' })
    await expect(isEngineAvailable()).resolves.toBe(true)
    await expect(clearProjectSearchSession('p1')).resolves.toEqual({ success: true })
    await expect(clearProjectIndex('p1')).resolves.toEqual({ success: true })

    expect(clearEngineSearchSession).toHaveBeenCalledWith('p1')
    expect(clearEngineIndexMeta).toHaveBeenCalledWith('p1')
    expect(fsUnlink).toHaveBeenCalledWith('/tmp/p1.sqlite')
  })
})
