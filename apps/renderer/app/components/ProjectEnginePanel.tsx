import { useEffect, useMemo, useState } from 'react'
import { Database, Eraser, FolderOpen, GitBranch, RefreshCcw, Search } from 'lucide-react'
import { GitWorkspacePanel } from './GitWorkspacePanel'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { ScrollArea } from './ui/ScrollArea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'
import type {
  EngineGitInsights,
  EngineIndexProfile,
  EngineIndexResult,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitFileDiffResult,
  GitPushResult,
  GitWorkflowState,
  Project,
} from '../types'

const INDEX_PROFILES: Array<{
  value: EngineIndexProfile
  label: string
  description: string
}> = [
  {
    value: 'source-first',
    label: 'Source first (recommended)',
    description: 'Code and config only. Skips planning HTML, marketing sites, and pure docs for a smaller, faster index.',
  },
  {
    value: 'source-docs',
    label: 'Source + docs',
    description: 'Includes Markdown and docs. Still excludes landing/marketing and build output.',
  },
  {
    value: 'full-text',
    label: 'Full text',
    description: 'Index all supported text files. Largest index — use when you need plans and wiki content in search.',
  },
]

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
  onLoadFileDiff,
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
  onIndexProject: (
    projectId: string,
    options?: { profile?: EngineIndexProfile },
  ) => Promise<unknown>
  onSearch: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadStats: (projectId: string) => Promise<EngineStats>
  onLoadGitInsights: (projectId: string) => Promise<EngineGitInsights>
  onLoadGitState: (projectId: string) => Promise<GitWorkflowState>
  onLoadFileDiff: (projectId: string, relativePath: string) => Promise<GitFileDiffResult>
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
  const [indexProfile, setIndexProfile] = useState<EngineIndexProfile>(
    selectedIndex?.indexProfile ?? 'source-first',
  )
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

  const activeProfileMeta = INDEX_PROFILES.find((entry) => entry.value === indexProfile) ?? INDEX_PROFILES[0]
  const profileDirty =
    Boolean(selectedIndex) &&
    (selectedIndex?.indexProfile ?? 'source-first') !== indexProfile

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
    setIndexProfile(selectedIndex?.indexProfile ?? latestIndexResult?.profile ?? 'source-first')
  }, [project.id, selectedIndex?.indexProfile, latestIndexResult?.profile])

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
      await onIndexProject(project.id, { profile: indexProfile })
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
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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

        <div className="space-y-4 rounded-lg border border-border/40 bg-card p-5">
          {/* Index controls — scope + index lifecycle actions */}
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label
                  htmlFor={`index-profile-${project.id}`}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Index scope
                </Label>
                <Select
                  value={indexProfile}
                  onValueChange={(value) => setIndexProfile(value as EngineIndexProfile)}
                  disabled={!engineStatus?.available || isIndexing}
                >
                  <SelectTrigger id={`index-profile-${project.id}`} className="h-9 bg-background text-[12px]">
                    <SelectValue placeholder="Choose what to index" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDEX_PROFILES.map((profile) => (
                      <SelectItem key={profile.value} value={profile.value} className="text-[12px]">
                        {profile.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 gap-2 text-[11px] font-semibold"
                  onClick={() => void handleIndex()}
                  disabled={!engineStatus?.available || isIndexing}
                >
                  <Database className="h-3.5 w-3.5" />
                  {isIndexing
                    ? 'Indexing...'
                    : selectedIndex
                      ? profileDirty
                        ? 'Reindex with new scope'
                        : 'Reindex Project'
                      : 'Index Project'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 text-[11px] font-semibold text-destructive hover:text-destructive"
                  onClick={() => void handleClearIndex()}
                  disabled={isClearingIndex || !selectedIndex}
                >
                  <Eraser className="h-3.5 w-3.5" />
                  {isClearingIndex ? 'Removing...' : 'Clear Index'}
                </Button>
                {onOpenEngine ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 text-[11px] font-semibold"
                    onClick={() => onOpenEngine(project.id)}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Open Engine Workspace
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {activeProfileMeta.description}
              {profileDirty ? (
                <span className="mt-1 block font-medium text-amber-600 dark:text-amber-400">
                  Profile changed — reindex to apply (search still uses the previous index until then).
                </span>
              ) : null}
            </p>
          </div>

          {/* Search controls — query + search actions only */}
          <div className="space-y-2 border-t border-border/30 pt-4">
            <Label
              htmlFor={`engine-search-${project.id}`}
              className="text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Search
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id={`engine-search-${project.id}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSearch()
                  }
                }}
                placeholder={
                  selectedIndex
                    ? `Search indexed code in ${project.name}`
                    : `Search ${project.name} (auto-indexes on first search)`
                }
                className="h-9 min-w-0 flex-1 bg-background"
              />
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant={regex ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 px-3 text-[11px] font-semibold"
                  onClick={() => setRegex((prev) => !prev)}
                  aria-pressed={regex}
                >
                  Regex {regex ? 'On' : 'Off'}
                </Button>
                <Button
                  size="sm"
                  className="h-9 gap-2 px-4 text-[11px] font-semibold"
                  onClick={() => void handleSearch()}
                  disabled={!engineStatus?.available || isSearching}
                >
                  <Search className="h-3.5 w-3.5" />
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 text-[11px] font-semibold"
                  onClick={() => void handleClearSearch()}
                  disabled={isClearingSearch || !selectedSession}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isClearingSearch ? 'Clearing...' : 'Clear Search'}
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
              {selectedIndex ? (
                <>
                  Indexed {selectedIndex.fileCount.toLocaleString()} files
                  {' · '}
                  scope{' '}
                  <span className="font-medium text-foreground">
                    {selectedIndex.indexProfile ?? 'source-first'}
                  </span>
                  . Last updated {formatDate(selectedIndex.lastIndexed)}.
                </>
              ) : (
                <>
                  This project has not been indexed yet. First search auto-indexes with{' '}
                  <span className="font-medium text-foreground">source-first</span> unless you index
                  manually.
                </>
              )}
            </div>
          </div>

          {latestIndexResult ? (
            <div className="rounded-md bg-muted/25 p-3 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={latestIndexResult.ok ? 'success' : 'destructive'}
                  className="text-[10px] uppercase tracking-wider"
                >
                  {latestIndexResult.ok ? 'Last Index Succeeded' : 'Last Index Failed'}
                </Badge>
                {latestIndexResult.profile ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {latestIndexResult.profile}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[10px]">
                  {latestIndexResult.filesIndexed.toLocaleString()} indexed
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {latestIndexResult.filesSkipped.toLocaleString()} skipped
                </Badge>
                {latestIndexResult.metrics ? (
                  <Badge variant="outline" className="text-[10px]">
                    {formatBytes(latestIndexResult.metrics.logicalIndexedBytes)} logical
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[10px]">
                  {latestIndexResult.durationMs}ms
                </Badge>
              </div>
              <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground">
                {latestIndexResult.repo && (
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={latestIndexResult.repo}>
                      {latestIndexResult.repo}
                    </span>
                  </div>
                )}
                {latestIndexResult.db && (
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={latestIndexResult.db}>
                      {latestIndexResult.db}
                    </span>
                  </div>
                )}
              </div>
              {latestIndexResult.warnings.length > 0 ? (
                <div className="mt-2 space-y-1 border-t border-border/30 pt-2 text-muted-foreground">
                  {latestIndexResult.warnings.slice(0, 3).map((warning) => (
                    <p key={warning}>Warning: {warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Results + summary: top-aligned so empty results don't create a tall void */}
          <div className="grid items-start gap-4 border-t border-border/30 pt-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {searchResult ? (
                <div className="rounded-md border border-border/30 bg-muted/15">
                  <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
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
                        <div className="rounded-md border border-dashed border-border/40 px-3 py-6 text-center text-[11px] text-muted-foreground">
                          No indexed matches found for this query.
                        </div>
                      ) : (
                        searchResult.results.map((result) => {
                          const firstMatch = result.matches[0]
                          const openKey = `${result.path}:${firstMatch?.line ?? 0}:${firstMatch?.column ?? 0}`
                          return (
                            <div key={openKey} className="space-y-3 rounded-md bg-background/50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-xs font-semibold">{result.path}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Score {result.score.toFixed(2)}
                                    {result.language ? ` / ${result.language}` : ''}
                                    {result.matches.length > 0
                                      ? ` / ${result.matches.length} matches`
                                      : ''}
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
                                        firstMatch
                                          ? { line: firstMatch.line, column: firstMatch.column }
                                          : undefined,
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
                                  className="w-full rounded-md bg-muted/30 px-3 py-2 text-left text-[11px] text-muted-foreground"
                                  onClick={() =>
                                    void handleOpenResult(result.path, {
                                      line: firstMatch.line,
                                      column: firstMatch.column,
                                    })
                                  }
                                >
                                  {firstMatch.contextBefore.map((line, index) => (
                                    <div key={`before-${index}`} className="font-mono opacity-70">
                                      {line}
                                    </div>
                                  ))}
                                  <div className="font-mono">
                                    <span className="font-semibold text-foreground">
                                      Line {firstMatch.line}:
                                    </span>{' '}
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
              ) : (
                <div className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-md border border-dashed border-border/35 bg-muted/10 px-4 py-6 text-center">
                  <Search className="mb-2 h-5 w-5 text-muted-foreground/50" />
                  <p className="text-[12px] font-medium text-muted-foreground">No search results yet</p>
                  <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground/80">
                    Run a query above. Matches open here without covering the git workspace below.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Index Summary</p>
                {isLoadingStats ? (
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                ) : null}
              </div>
              {stats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Files</p>
                      <p className="mt-1 text-lg font-semibold">
                        {stats.stats.totalFiles.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-md bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Logical size
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatBytes(stats.stats.totalSizeBytes)}
                      </p>
                      <p className="mt-1 text-[9px] text-muted-foreground">Sum of indexed file sizes</p>
                    </div>
                    <div className="rounded-md bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Searchable
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatBytes(stats.stats.searchableContentBytes ?? 0)}
                      </p>
                      <p className="mt-1 text-[9px] text-muted-foreground">Content stored for search</p>
                    </div>
                    <div className="rounded-md bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Index DB
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatBytes(stats.stats.physicalDbBytes ?? 0)}
                      </p>
                      {stats.db ? (
                        <p
                          className="mt-1 truncate text-[9px] text-muted-foreground"
                          title={stats.db}
                        >
                          {stats.db.split(/[\\/]/).pop()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {latestIndexResult?.profile ? (
                    <p className="text-[10px] text-muted-foreground">
                      Last index profile:{' '}
                      <span className="font-medium text-foreground">{latestIndexResult.profile}</span>
                      {latestIndexResult.skipReasons ? (
                        <span>
                          {' '}
                          · skipped binary {latestIndexResult.skipReasons.binary}, language{' '}
                          {latestIndexResult.skipReasons.language}, policy{' '}
                          {latestIndexResult.skipReasons.profile +
                            latestIndexResult.skipReasons.devdeskignore}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {stats.stats.largestFiles && stats.stats.largestFiles.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Largest indexed
                      </p>
                      <ul className="space-y-1">
                        {stats.stats.largestFiles.slice(0, 5).map((file) => (
                          <li
                            key={file.path}
                            className="flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground"
                          >
                            <span className="min-w-0 truncate font-mono" title={file.path}>
                              {file.path.split(/[\\/]/).slice(-2).join('/')}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatBytes(file.sizeBytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Top Languages
                    </p>
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
                  {selectedIndex
                    ? 'Stats will appear after the index metadata loads.'
                    : 'Index this project to see search statistics.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <GitWorkspacePanel
        project={project}
        onLoadGitInsights={onLoadGitInsights}
        onLoadGitState={onLoadGitState}
        onLoadFileDiff={onLoadFileDiff}
        onCommitChanges={onCommitChanges}
        onPushBranch={onPushBranch}
        onCreatePullRequest={onCreatePullRequest}
        onOpenExternalUrl={onOpenExternalUrl}
        onOpenResult={async (projectId, relativePath) => onOpenResult(projectId, relativePath)}
        onRevealResult={onRevealResult}
      />

      {actionError ? (
        <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-[11px] text-destructive">
          {actionError}
        </div>
      ) : null}
    </div>
  )
}
