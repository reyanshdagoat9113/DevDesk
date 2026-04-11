import { useEffect, useMemo, useState } from 'react'
import { Database, Eraser, FolderOpen, GitBranch, RefreshCcw, Search } from 'lucide-react'
import { GitWorkspacePanel } from './GitWorkspacePanel'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { ScrollArea } from './ui/ScrollArea'
import type {
  EngineGitInsights,
  EngineIndexResult,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitPushResult,
  GitWorkflowState,
  Project,
} from '../types'

function formatDate(value?: string) {
  if (!value) return 'Not indexed yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let current = bytes
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current.toFixed(current >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export function ProjectEnginePanel({
  project,
  engineStatus,
  engineIndexes,
  searchSessions,
  onIndexProject,
  onSearch,
  onLoadStats,
  onLoadGitInsights,
  onLoadGitState,
  onCommitChanges,
  onPushBranch,
  onCreatePullRequest,
  onOpenResult,
  onRevealResult,
  onClearProjectIndex,
  onClearSearchSession,
  onOpenExternalUrl,
  onOpenEngine,
  indexingProjects,
  latestIndexResults,
}: {
  project: Project
  engineStatus: EngineStatus | null
  engineIndexes: Record<string, EngineIndexMeta>
  searchSessions: Record<string, EngineSearchSession>
  indexingProjects: Record<string, boolean>
  latestIndexResults: Record<string, EngineIndexResult>
  onIndexProject: (projectId: string) => Promise<unknown>
  onSearch: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadStats: (projectId: string) => Promise<EngineStats>
  onLoadGitInsights: (projectId: string) => Promise<EngineGitInsights>
  onLoadGitState: (projectId: string) => Promise<GitWorkflowState>
  onCommitChanges: (projectId: string, message: string) => Promise<GitCommitResult>
  onPushBranch: (projectId: string) => Promise<GitPushResult>
  onCreatePullRequest: (
    projectId: string,
    input: { title: string; body: string; isDraft: boolean; baseBranch?: string }
  ) => Promise<GitCreatePullRequestResult>
  onOpenResult: (projectId: string, relativePath: string, location?: { line?: number; column?: number }) => Promise<void>
  onRevealResult: (projectId: string, relativePath: string) => Promise<void>
  onClearProjectIndex: (projectId: string) => Promise<void>
  onClearSearchSession: (projectId: string) => Promise<void>
  onOpenExternalUrl: (url: string) => Promise<void>
  onOpenEngine?: (projectId: string) => void
}) {
  const selectedIndex = engineIndexes[project.id] ?? null
  const selectedSession = searchSessions[project.id] ?? null
  const latestIndexResult = latestIndexResults[project.id] ?? null
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [searchResult, setSearchResult] = useState<EngineSearchResult | null>(null)
  const [stats, setStats] = useState<EngineStats | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isIndexing, setIsIndexing] = useState(Boolean(indexingProjects[project.id]))
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isClearingIndex, setIsClearingIndex] = useState(false)
  const [isClearingSearch, setIsClearingSearch] = useState(false)
  const [openingResultKey, setOpeningResultKey] = useState<string | null>(null)
  const [revealingResultKey, setRevealingResultKey] = useState<string | null>(null)

  const topLanguages = useMemo(() => {
    if (!stats) {
      return []
    }
    return Object.entries(stats.stats.byLanguage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [stats])

  useEffect(() => {
    setActionError(null)
    setQuery(selectedSession?.query ?? '')
    setRegex(selectedSession?.regex ?? false)
    setSearchResult(selectedSession?.result ?? null)
  }, [project.id, selectedSession])

  useEffect(() => {
    setIsIndexing(Boolean(indexingProjects[project.id]))
  }, [indexingProjects, project.id])

  useEffect(() => {
    if (!selectedIndex) {
      setStats(null)
      return
    }

    let cancelled = false
    setIsLoadingStats(true)
    onLoadStats(project.id)
      .then((result) => {
        if (!cancelled) {
          setStats(result)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : 'Failed to load engine stats.')
          setStats(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingStats(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [onLoadStats, project.id, selectedIndex])

  const handleIndex = async () => {
    if (isIndexing) return
    setActionError(null)
    setIsIndexing(true)
    try {
      await onIndexProject(project.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to index project.')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSearch = async () => {
    if (isSearching || !engineStatus?.available) return
    const trimmed = query.trim()
    if (!trimmed) {
      setActionError('Search query is required.')
      return
    }

    setActionError(null)
    setIsSearching(true)
    try {
      const result = await onSearch(project.id, trimmed, { regex, limit: 20 })
      setSearchResult(result)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to search project.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleClearIndex = async () => {
    if (isClearingIndex) return
    setActionError(null)
    setIsClearingIndex(true)
    try {
      await onClearProjectIndex(project.id)
      setSearchResult(null)
      setStats(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to clear project index.')
    } finally {
      setIsClearingIndex(false)
    }
  }

  const handleClearSearch = async () => {
    if (isClearingSearch) return
    setActionError(null)
    setIsClearingSearch(true)
    try {
      await onClearSearchSession(project.id)
      setSearchResult(null)
      setQuery('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to clear saved search.')
    } finally {
      setIsClearingSearch(false)
    }
  }

  const handleOpenResult = async (relativePath: string, location?: { line?: number; column?: number }) => {
    const key = `${relativePath}:${location?.line ?? 0}:${location?.column ?? 0}`
    setActionError(null)
    setOpeningResultKey(key)
    try {
      await onOpenResult(project.id, relativePath, location)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to open search result.')
    } finally {
      setOpeningResultKey(null)
    }
  }

  const handleRevealResult = async (relativePath: string) => {
    setActionError(null)
    setRevealingResultKey(relativePath)
    try {
      await onRevealResult(project.id, relativePath)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to reveal file.')
    } finally {
      setRevealingResultKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
          Performance Engine
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={engineStatus?.available ? 'success' : 'outline'} className="text-[10px] uppercase tracking-wider">
            {engineStatus?.available ? 'Available' : 'Unavailable'}
          </Badge>
          <Badge variant={selectedIndex ? 'secondary' : 'outline'} className="text-[10px] uppercase tracking-wider">
            {selectedIndex ? 'Indexed' : 'Not Indexed'}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/5 p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-2 text-[11px] font-semibold"
            onClick={() => void handleIndex()}
            disabled={!engineStatus?.available || isIndexing}
          >
            <Database className="h-3.5 w-3.5" />
            {isIndexing ? 'Indexing...' : selectedIndex ? 'Reindex Project' : 'Index Project'}
          </Button>
          {onOpenEngine ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-[11px] font-semibold"
              onClick={() => onOpenEngine(project.id)}
            >
              <Search className="h-3.5 w-3.5" />
              Open Engine Workspace
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-[11px] font-semibold"
            onClick={() => void handleClearSearch()}
            disabled={isClearingSearch || !selectedSession}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isClearingSearch ? 'Clearing...' : 'Clear Saved Search'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-[11px] font-semibold text-destructive hover:text-destructive"
            onClick={() => void handleClearIndex()}
            disabled={isClearingIndex || !selectedIndex}
          >
            <Eraser className="h-3.5 w-3.5" />
            {isClearingIndex ? 'Removing...' : 'Clear Index'}
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_320px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSearch()
                  }
                }}
                placeholder={selectedIndex ? `Search indexed code in ${project.name}` : `Search ${project.name} (auto-indexes on first search)`}
                className="h-10 bg-background"
              />
              <div className="flex gap-2">
                <Button
                  variant={regex ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 px-4 text-[11px] font-semibold"
                  onClick={() => setRegex((prev) => !prev)}
                >
                  Regex {regex ? 'On' : 'Off'}
                </Button>
                <Button
                  size="sm"
                  className="h-10 gap-2 px-4 text-[11px] font-semibold"
                  onClick={() => void handleSearch()}
                  disabled={!engineStatus?.available || isSearching}
                >
                  <Search className="h-3.5 w-3.5" />
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
              {selectedIndex ? (
                <>Indexed {selectedIndex.fileCount.toLocaleString()} files. Last updated {formatDate(selectedIndex.lastIndexed)}.</>
              ) : (
                <>This project has not been indexed yet. Search will auto-index it on first run.</>
              )}
            </div>

            {latestIndexResult ? (
              <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={latestIndexResult.ok ? 'success' : 'destructive'} className="text-[10px] uppercase tracking-wider">
                    {latestIndexResult.ok ? 'Last Index Succeeded' : 'Last Index Failed'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {latestIndexResult.filesIndexed.toLocaleString()} indexed
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {latestIndexResult.filesSkipped.toLocaleString()} skipped
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {latestIndexResult.durationMs}ms
                  </Badge>
                </div>
                <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground">
                  {latestIndexResult.repo && (
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate" title={latestIndexResult.repo}>{latestIndexResult.repo}</span>
                    </div>
                  )}
                  {latestIndexResult.db && (
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3 w-3 shrink-0" />
                      <span className="truncate" title={latestIndexResult.db}>{latestIndexResult.db}</span>
                    </div>
                  )}
                </div>
                {latestIndexResult.warnings.length > 0 ? (
                  <div className="mt-2 space-y-1 text-muted-foreground border-t border-border/30 pt-2">
                    {latestIndexResult.warnings.slice(0, 3).map((warning) => (
                      <p key={warning}>Warning: {warning}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {searchResult ? (
              <div className="rounded-xl border border-border/40 bg-background/50">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Search Results</p>
                    <p className="text-[11px] text-muted-foreground">
                      {searchResult.totalMatches} files in {searchResult.durationMs}ms
                    </p>
                  </div>
                </div>
                <ScrollArea className="h-72">
                  <div className="space-y-3 p-4">
                    {searchResult.results.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/40 px-3 py-6 text-center text-[11px] text-muted-foreground">
                        No indexed matches found for this query.
                      </div>
                    ) : (
                      searchResult.results.map((result) => {
                        const firstMatch = result.matches[0]
                        const openKey = `${result.path}:${firstMatch?.line ?? 0}:${firstMatch?.column ?? 0}`
                        return (
                          <div key={openKey} className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-xs font-semibold">{result.path}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Score {result.score.toFixed(2)}
                                  {result.language ? ` / ${result.language}` : ''}
                                  {result.matches.length > 0 ? ` / ${result.matches.length} matches` : ''}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => void handleRevealResult(result.path)}
                                  disabled={revealingResultKey === result.path}
                                >
                                  <FolderOpen className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-[10px]"
                                  onClick={() =>
                                    void handleOpenResult(
                                      result.path,
                                      firstMatch ? { line: firstMatch.line, column: firstMatch.column } : undefined
                                    )
                                  }
                                  disabled={openingResultKey === openKey}
                                >
                                  Open
                                </Button>
                              </div>
                            </div>
                            {firstMatch ? (
                              <button
                                type="button"
                                className="w-full rounded-md bg-background px-3 py-2 text-left text-[11px] text-muted-foreground"
                                onClick={() =>
                                  void handleOpenResult(
                                    result.path,
                                    { line: firstMatch.line, column: firstMatch.column }
                                  )
                                }
                              >
                                {firstMatch.contextBefore.map((line, index) => (
                                  <div key={`before-${index}`} className="font-mono opacity-70">
                                    {line}
                                  </div>
                                ))}
                                <div className="font-mono">
                                  <span className="font-semibold text-foreground">Line {firstMatch.line}:</span>{' '}
                                  {firstMatch.snippet}
                                </div>
                                {firstMatch.contextAfter.map((line, index) => (
                                  <div key={`after-${index}`} className="font-mono opacity-70">
                                    {line}
                                  </div>
                                ))}
                              </button>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </div>

          <div>
            <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Index Summary</p>
                {isLoadingStats ? <span className="text-[10px] text-muted-foreground">Loading...</span> : null}
              </div>
              {stats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Files</p>
                      <p className="mt-1 text-lg font-semibold">{stats.stats.totalFiles.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                      <p className="mt-1 text-lg font-semibold">{formatBytes(stats.stats.totalSizeBytes)}</p>
                      {stats.db && <p className="mt-1 truncate text-[9px] text-muted-foreground" title={stats.db}>{stats.db.split(/[\\/]/).pop()}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {topLanguages.length > 0 ? (
                        topLanguages.map(([language, count]) => (
                          <Badge key={language} variant="outline" className="text-[10px]">
                            {language}: {count}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No language data yet.</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {selectedIndex ? 'Stats will appear after the index metadata loads.' : 'Index this project to see search statistics.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <GitWorkspacePanel
          project={project}
          onLoadGitInsights={onLoadGitInsights}
          onLoadGitState={onLoadGitState}
          onCommitChanges={onCommitChanges}
          onPushBranch={onPushBranch}
          onCreatePullRequest={onCreatePullRequest}
          onOpenExternalUrl={onOpenExternalUrl}
          onOpenResult={async (projectId, relativePath) => onOpenResult(projectId, relativePath)}
          onRevealResult={onRevealResult}
        />

        {actionError ? (
          <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
