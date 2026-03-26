/**
 * Engine Service - Wrapper for devdesk-engine integration
 *
 * This service provides a safe interface to the devdesk-engine performance engine.
 * It handles errors gracefully and provides fallback behavior.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

// Lazy-loaded engine module
let engineModule: typeof import('devdesk-engine') | null = null

// Types from devdesk-engine
export interface EngineIndexResult {
  ok: boolean
  repo: string
  db: string
  filesIndexed: number
  filesSkipped: number
  durationMs: number
  warnings: string[]
}

export interface EngineSearchMatch {
  line: number
  column: number
  snippet: string
  contextBefore: string[]
  contextAfter: string[]
}

export interface EngineFileSearchResult {
  path: string
  language: string | null
  score: number
  matches: EngineSearchMatch[]
}

export interface EngineSearchResult {
  ok: boolean
  query: string
  results: EngineFileSearchResult[]
  totalMatches: number
  durationMs: number
}

export interface EngineStatsResult {
  ok: boolean
  db: string
  stats: {
    totalFiles: number
    totalSizeBytes: number
    byLanguage: Record<string, number>
    indexedAt: string
  }
}

export interface EngineGitInsights {
  branch: string
  totalCommits: number
  contributors: string[]
  hotspots: Array<{
    path: string
    score: number
    commits: number
    recency: number
    risk: 'low' | 'medium' | 'high'
  }>
  recentCommits: Array<{
    hash: string
    author: string
    date: string
    message: string
    files: string[]
  }>
  churnFiles: Array<{
    path: string
    commits: number
    authors: string[]
    lastModified: string
    linesAdded: number
    linesDeleted: number
  }>
}

// Engine state per project
interface EngineState {
  dbPath: string
  projectPath: string
  isIndexed: boolean
  lastIndexedAt?: number
}

const engineStates = new Map<string, EngineState>()

/**
 * Get the database path for a project
 */
function getDbPath(projectId: string): string {
  const userDataPath = app.getPath('userData')
  const engineDir = path.join(userDataPath, 'engine')

  // Ensure directory exists
  fs.mkdir(engineDir, { recursive: true }).catch(() => {})

  return path.join(engineDir, `${projectId}.sqlite`)
}

/**
 * Get or create engine state for a project
 */
function getOrCreateState(projectId: string, projectPath: string): EngineState {
  let state = engineStates.get(projectId)

  if (!state || state.projectPath !== projectPath) {
    state = {
      dbPath: getDbPath(projectId),
      projectPath,
      isIndexed: false,
    }
    engineStates.set(projectId, state)
  }

  return state
}

/**
 * Try to import the engine module
 */
async function getEngine(): Promise<typeof import('devdesk-engine') | null> {
  if (engineModule !== null) {
    return engineModule
  }

  try {
    engineModule = await import('devdesk-engine')
    return engineModule
  } catch (error) {
    console.error('[EngineService] Failed to load devdesk-engine:', error)
    return null
  }
}

/**
 * Index a project using the engine
 */
export async function indexProject(
  projectId: string,
  projectPath: string
): Promise<EngineIndexResult> {
  const engine = await getEngine()

  if (!engine) {
    return {
      ok: false,
      repo: projectPath,
      db: getDbPath(projectId),
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      warnings: ['devdesk-engine is not available'],
    }
  }

  const state = getOrCreateState(projectId, projectPath)

  try {
    const result = await engine.indexRepository({
      repo: projectPath,
      db: state.dbPath,
      incremental: state.isIndexed,
    })

    if (result.ok) {
      state.isIndexed = true
      state.lastIndexedAt = Date.now()
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EngineService] Index failed:', message)

    return {
      ok: false,
      repo: projectPath,
      db: state.dbPath,
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      warnings: [`Indexing failed: ${message}`],
    }
  }
}

/**
 * Search a project using the engine
 */
export async function searchProject(
  projectId: string,
  projectPath: string,
  query: string,
  options?: { regex?: boolean; limit?: number }
): Promise<EngineSearchResult> {
  const engine = await getEngine()
  const state = getOrCreateState(projectId, projectPath)

  if (!engine) {
    return {
      ok: false,
      query,
      results: [],
      totalMatches: 0,
      durationMs: 0,
    }
  }

  if (!state.isIndexed) {
    // Auto-index if not indexed
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

  try {
    const result = await engine.searchIndex({
      db: state.dbPath,
      query,
      regex: options?.regex ?? false,
      limit: options?.limit ?? 50,
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EngineService] Search failed:', message)

    return {
      ok: false,
      query,
      results: [],
      totalMatches: 0,
      durationMs: 0,
    }
  }
}

/**
 * Get stats for a project index
 */
export async function getProjectStats(
  projectId: string,
  projectPath: string
): Promise<EngineStatsResult | null> {
  const engine = await getEngine()
  const state = getOrCreateState(projectId, projectPath)

  if (!engine || !state.isIndexed) {
    return null
  }

  try {
    return engine.getStats(state.dbPath)
  } catch (error) {
    console.error('[EngineService] Get stats failed:', error)
    return null
  }
}

/**
 * Get git insights for a project
 */
export async function getProjectGitInsights(
  projectPath: string
): Promise<EngineGitInsights | null> {
  const engine = await getEngine()

  if (!engine) {
    return null
  }

  try {
    return engine.getGitInsights(projectPath)
  } catch (error) {
    console.error('[EngineService] Get git insights failed:', error)
    return null
  }
}

/**
 * Clear the engine index for a project
 */
export async function clearProjectIndex(projectId: string): Promise<{ success: boolean }> {
  const state = engineStates.get(projectId)

  if (state) {
    state.isIndexed = false
    state.lastIndexedAt = undefined

    // Delete the database file
    try {
      await fs.unlink(state.dbPath)
    } catch {
      // File might not exist, that's fine
    }
  }

  engineStates.delete(projectId)
  return { success: true }
}

/**
 * Check if the engine is available
 */
export async function isEngineAvailable(): Promise<boolean> {
  const engine = await getEngine()
  return engine !== null
}

/**
 * Check if a project is indexed
 */
export function isProjectIndexed(projectId: string): boolean {
  const state = engineStates.get(projectId)
  return state?.isIndexed ?? false
}
