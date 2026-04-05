import fs from 'node:fs/promises'
import path from 'node:path'
import {
  clearEngineIndexMeta,
  clearEngineSearchSession,
  listEngineIndexes,
  listEngineSearchSessions,
  upsertEngineIndex,
  upsertEngineSearchSession,
} from '../data/store'
import type { EngineIndexMeta, EngineSearchSession } from '../data/model'
import {
  engineGit,
  engineIndex,
  engineSearch,
  engineStats,
  getEngineDbPath,
  getEngineStatus,
} from './binary'
import type {
  EngineGitInsights,
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from './types'

export interface EngineSnapshot {
  status: EngineStatus
  indexes: Record<string, EngineIndexMeta>
  searchSessions: Record<string, EngineSearchSession>
}

async function hasIndexMetadata(projectId: string) {
  const indexes = await listEngineIndexes()
  const entry = indexes[projectId]
  if (entry) {
    return entry
  }

  try {
    await fs.access(getEngineDbPath(projectId))
    return {
      projectId,
      dbPath: getEngineDbPath(projectId),
      lastIndexed: '',
      fileCount: 0,
    } satisfies EngineIndexMeta
  } catch {
    return null
  }
}

async function persistIndexMetadata(projectId: string, result: EngineIndexResult) {
  const entry: EngineIndexMeta = {
    projectId,
    dbPath: result.db,
    lastIndexed: new Date().toISOString(),
    fileCount: result.filesIndexed,
  }
  await upsertEngineIndex(entry)
  return entry
}

async function persistSearchSession(projectId: string, query: string, regex: boolean, result: EngineSearchResult) {
  const session: EngineSearchSession = {
    projectId,
    query,
    regex,
    updatedAt: new Date().toISOString(),
    result,
  }
  await upsertEngineSearchSession(session)
  return session
}

function normalizeSearchResultPaths(projectPath: string, result: EngineSearchResult): EngineSearchResult {
  return {
    ...result,
    results: result.results.map((entry) => {
      const relativePath = path.relative(projectPath, entry.path)
      const normalizedPath =
        relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
          ? relativePath.replace(/\\/g, '/')
          : entry.path.replace(/\\/g, '/')

      return {
        ...entry,
        path: normalizedPath,
      }
    }),
  }
}

export async function loadEngineSnapshot(): Promise<EngineSnapshot> {
  const [status, indexes, searchSessions] = await Promise.all([
    getEngineStatus(),
    listEngineIndexes(),
    listEngineSearchSessions(),
  ])

  return {
    status,
    indexes,
    searchSessions,
  }
}

export async function indexProject(projectId: string, projectPath: string): Promise<EngineIndexResult> {
  const result = await engineIndex(projectPath, projectId)

  if (result.ok) {
    await persistIndexMetadata(projectId, result)
  }

  return result
}

export async function searchProject(
  projectId: string,
  projectPath: string,
  query: string,
  options?: { regex?: boolean; limit?: number }
): Promise<EngineSearchResult> {
  const existingIndex = await hasIndexMetadata(projectId)

  if (!existingIndex) {
    const indexResult = await indexProject(projectId, projectPath)
    if (!indexResult.ok) {
      return {
        ok: false,
        query,
        results: [],
        totalMatches: 0,
        durationMs: 0,
      }
    }
  }

  const result = normalizeSearchResultPaths(projectPath, await engineSearch(projectId, query, options))
  await persistSearchSession(projectId, query, Boolean(options?.regex), result)
  return result
}

export async function getProjectStats(projectId: string): Promise<EngineStats | null> {
  const existingIndex = await hasIndexMetadata(projectId)
  if (!existingIndex) {
    return null
  }

  try {
    const result = await engineStats(projectId)
    if (existingIndex.lastIndexed === '' || existingIndex.fileCount === 0) {
      await upsertEngineIndex({
        projectId,
        dbPath: result.db,
        lastIndexed: result.stats.indexedAt,
        fileCount: result.stats.totalFiles,
      })
    }
    return result
  } catch {
    return null
  }
}

export async function getProjectGitInsights(projectPath: string): Promise<EngineGitInsights | null> {
  try {
    return await engineGit(projectPath)
  } catch {
    return null
  }
}

export async function clearProjectIndex(projectId: string): Promise<{ success: boolean }> {
  const dbPath = getEngineDbPath(projectId)

  await Promise.all([
    clearEngineIndexMeta(projectId),
    clearEngineSearchSession(projectId),
    fs.unlink(dbPath).catch(() => undefined),
  ])

  return { success: true }
}

export async function clearProjectSearchSession(projectId: string): Promise<{ success: boolean }> {
  await clearEngineSearchSession(projectId)
  return { success: true }
}

export async function isEngineAvailable(): Promise<boolean> {
  const status = await getEngineStatus()
  return status.available
}
