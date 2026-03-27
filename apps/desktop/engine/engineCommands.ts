/**
 * Engine Commands
 *
 * These are example commands that demonstrate how to use the devdesk-engine
 * performance engine integration from DevDesk.
 *
 * The engine provides:
 * - Fast code indexing (using Rust scanner + SQLite FTS5)
 * - Full-text search with BM25 ranking
 * - Git insights (hotspots, churn, contributors)
 *
 * USAGE:
 * These commands can be triggered from the DevDesk UI or via IPC.
 * The renderer process calls these through window.electronAPI methods.
 */

import type { BrowserWindow } from 'electron'
import type { EngineGitInsights, EngineIndexResult, EngineSearchResult, EngineStats as EngineStatsResult } from './types'
import {
  indexProject,
  searchProject,
  getProjectStats,
  getProjectGitInsights,
  clearProjectIndex,
  isEngineAvailable,
} from './engineService'
import { getProjectById } from '../data/store'

// Helper function to get project path from store
async function getProjectPath(projectId: string): Promise<string | null> {
  const project = await getProjectById(projectId)
  return project?.path ?? null
}

/**
 * Example: Index a project and send progress to renderer
 *
 * IPC: window.electronAPI.indexProject(projectId)
 */
export async function handleIndexProject(
  event: { sender: BrowserWindow },
  projectId: string
): Promise<EngineIndexResult> {
  const projectPath = await getProjectPath(projectId)

  if (!projectPath) {
    return {
      ok: false,
      repo: '',
      db: '',
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      warnings: ['Project not found'],
    }
  }

  // Notify renderer that indexing started
  event.sender.webContents.send('engine:indexing-started', { projectId })

  const result = await indexProject(projectId, projectPath)

  // Notify renderer that indexing completed
  event.sender.webContents.send('engine:indexing-completed', { projectId, result })

  return result
}

/**
 * Example: Search project content
 *
 * IPC: window.electronAPI.searchProjectContent(projectId, query, options)
 */
export async function handleSearchProject(
  _event: { sender: BrowserWindow },
  projectId: string,
  query: string,
  options?: { regex?: boolean; limit?: number }
): Promise<EngineSearchResult> {
  const projectPath = await getProjectPath(projectId)

  if (!projectPath) {
    return {
      ok: false,
      query,
      results: [],
      totalMatches: 0,
      durationMs: 0,
    }
  }

  return searchProject(projectId, projectPath, query, options)
}

/**
 * Example: Get project statistics
 *
 * IPC: window.electronAPI.getProjectStats(projectId)
 */
export async function handleGetProjectStats(
  _event: { sender: BrowserWindow },
  projectId: string
): Promise<EngineStatsResult | null> {
  const projectPath = await getProjectPath(projectId)

  if (!projectPath) {
    return null
  }

  return getProjectStats(projectId)
}

/**
 * Example: Get git insights for a project
 *
 * IPC: window.electronAPI.getProjectGitInsights(projectId)
 *
 * Returns:
 * - branch: current branch name
 * - totalCommits: number of commits
 * - contributors: list of contributor names
 * - hotspots: files with most changes (risk areas)
 * - recentCommits: latest commits
 * - churnFiles: files with highest change frequency
 */
export async function handleGetGitInsights(
  _event: { sender: BrowserWindow },
  projectId: string
): Promise<EngineGitInsights | null> {
  const projectPath = await getProjectPath(projectId)

  if (!projectPath) {
    return null
  }

  return getProjectGitInsights(projectPath)
}

/**
 * Example: Clear project index
 *
 * IPC: window.electronAPI.clearProjectIndex(projectId)
 */
export async function handleClearProjectIndex(
  _event: { sender: BrowserWindow },
  projectId: string
): Promise<{ success: boolean }> {
  return clearProjectIndex(projectId)
}

/**
 * Example: Check if engine is available
 *
 * IPC: window.electronAPI.isEngineAvailable()
 */
export async function handleIsEngineAvailable(): Promise<boolean> {
  return isEngineAvailable()
}

// ============================================================================
// RENDERER-SIDE USAGE EXAMPLES
// ============================================================================

/**
 * Example React component showing how to use engine in renderer:
 *
 * ```tsx
 * import { useState, useEffect } from 'react'
 *
 * function ProjectSearch({ projectId }: { projectId: string }) {
 *   const [query, setQuery] = useState('')
 *   const [results, setResults] = useState([])
 *   const [isIndexing, setIsIndexing] = useState(false)
 *   const [stats, setStats] = useState(null)
 *
 *   // Index project on mount
 *   useEffect(() => {
 *     async function indexProject() {
 *       setIsIndexing(true)
 *       const result = await window.electronAPI.indexProject(projectId)
 *       console.log('Indexed:', result.filesIndexed, 'files')
 *       setIsIndexing(false)
 *
 *       // Get stats
 *       const projectStats = await window.electronAPI.getProjectStats(projectId)
 *       setStats(projectStats?.stats)
 *     }
 *     indexProject()
 *   }, [projectId])
 *
 *   // Search handler
 *   async function handleSearch() {
 *     const searchResults = await window.electronAPI.searchProjectContent(
 *       projectId,
 *       query,
 *       { limit: 20 }
 *     )
 *     setResults(searchResults.results)
 *   }
 *
 *   return (
 *     <div>
 *       {isIndexing && <div>Indexing project...</div>}
 *       {stats && (
 *         <div>
 *           {stats.totalFiles} files indexed
 *         </div>
 *       )}
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Search code..."
 *       />
 *       <button onClick={handleSearch}>Search</button>
 *       <ul>
 *         {results.map((r) => (
 *           <li key={r.path}>
 *             {r.path} ({r.language}) - Score: {r.score}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */

/**
 * Example: Using git insights in renderer:
 *
 * ```tsx
 * function GitInsights({ projectId }: { projectId: string }) {
 *   const [insights, setInsights] = useState(null)
 *
 *   useEffect(() => {
 *     async function loadInsights() {
 *       const gitInsights = await window.electronAPI.getProjectGitInsights(projectId)
 *       setInsights(gitInsights)
 *     }
 *     loadInsights()
 *   }, [projectId])
 *
 *   if (!insights) return <div>Loading git insights...</div>
 *
 *   return (
 *     <div>
 *       <h2>Branch: {insights.branch}</h2>
 *       <p>{insights.totalCommits} commits by {insights.contributors.length} contributors</p>
 *
 *       <h3>Hotspot Files (Most Changed)</h3>
 *       <ul>
 *         {insights.hotspots.map((h) => (
 *           <li key={h.path}>
 *             {h.path} - {h.commits} changes, Risk: {h.risk}
 *           </li>
 *         ))}
 *       </ul>
 *
 *       <h3>Recent Commits</h3>
 *       <ul>
 *         {insights.recentCommits.map((c) => (
 *           <li key={c.hash}>
 *             {c.message} - {c.author}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
