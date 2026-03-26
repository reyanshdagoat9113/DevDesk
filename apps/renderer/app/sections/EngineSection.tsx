import { useEffect, useMemo, useState } from 'react'
import { Clock3, Code2, Database, Eraser, FolderOpen, RefreshCcw, Search, Terminal, Zap } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ScrollArea } from '../components/ui/ScrollArea'
import { SectionLayout } from '../layout/SectionLayout'
import type { EngineIndexMeta, EngineSearchResult, EngineSearchSession, EngineStats, EngineStatus, Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

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

function formatRelativeDate(value?: string) {
  if (!value) return 'No saved search'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.round(diffMs / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function EngineSection({
  projects,
  engineStatus,
  engineIndexes,
  searchSessions,
  selectedProjectId,
  onSelectProject,
  isLoading,
  error,
  onRefreshStatus,
  onIndexProject,
  onSearch,
  onLoadStats,
  onOpenResult,
  onRevealResult,
  onOpenProjectTerminal,
  onClearSearchSession,
}: {
  projects: Project[]
  engineStatus: EngineStatus | null
  engineIndexes: Record<string, EngineIndexMeta>
  searchSessions: Record<string, EngineSearchSession>
  selectedProjectId?: string | null
  onSelectProject?: (projectId: string) => void
  isLoading?: boolean
  error?: string | null
  onRefreshStatus?: () => Promise<void>
  onIndexProject?: (projectId: string) => Promise<void>
  onSearch?: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadStats?: (projectId: string) => Promise<EngineStats>
  onOpenResult?: (projectId: string, relativePath: string, location?: { line?: number; column?: number }) => Promise<void>
  onRevealResult?: (projectId: string, relativePath: string) => Promise<void>
  onOpenProjectTerminal?: (projectId: string) => Promise<void>
  onClearSearchSession?: (projectId: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [searchResult, setSearchResult] = useState<EngineSearchResult | null>(null)
  const [stats, setStats] = useState<EngineStats | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [openingResultKey, setOpeningResultKey] = useState<string | null>(null)
  const [revealingResultKey, setRevealingResultKey] = useState<string | null>(null)
  const [isOpeningTerminal, setIsOpeningTerminal] = useState(false)
  const [isClearingSearch, setIsClearingSearch] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedIndex = selectedProject ? engineIndexes[selectedProject.id] ?? null : null
  const selectedSession = selectedProject ? searchSessions[selectedProject.id] ?? null : null
  const hasDraftQueryChanges =
    query.trim() !== (selectedSession?.query ?? '') || regex !== (selectedSession?.regex ?? false)

  useEffect(() => {
    if (!selectedProject || !selectedIndex || !onLoadStats) {
      setStats(null)
      return
    }

    let cancelled = false
    setIsLoadingStats(true)
    onLoadStats(selectedProject.id)
      .then((result) => {
        if (!cancelled) {
          setStats(result)
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setActionError(nextError instanceof Error ? nextError.message : 'Failed to load engine stats.')
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
  }, [selectedProject, selectedIndex?.lastIndexed, onLoadStats])

  useEffect(() => {
    setActionError(null)
    setQuery(selectedSession?.query ?? '')
    setRegex(selectedSession?.regex ?? false)
    setSearchResult(selectedSession?.result ?? null)
  }, [selectedProjectId, selectedSession])

  const handleRefreshStatus = async () => {
    if (!onRefreshStatus || isRefreshingStatus) return
    setActionError(null)
    setIsRefreshingStatus(true)
    try {
      await onRefreshStatus()
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to refresh engine status.')
    } finally {
      setIsRefreshingStatus(false)
    }
  }

  const handleIndex = async () => {
    if (!selectedProject || !onIndexProject || isIndexing) return
    setActionError(null)
    setIsIndexing(true)
    try {
      await onIndexProject(selectedProject.id)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to index project.')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSearch = async () => {
    if (!selectedProject || !selectedIndex || !onSearch || isSearching) return
    const trimmed = query.trim()
    if (!trimmed) {
      setActionError('Search query is required.')
      return
    }

    setActionError(null)
    setIsSearching(true)
    try {
      const result = await onSearch(selectedProject.id, trimmed, { regex, limit: 25 })
      setSearchResult(result)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Search failed.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleOpenResult = async (relativePath: string, location?: { line?: number; column?: number }) => {
    if (!selectedProject || !onOpenResult) return
    const nextKey = `${relativePath}:${location?.line ?? 0}:${location?.column ?? 0}`
    setActionError(null)
    setOpeningResultKey(nextKey)
    try {
      await onOpenResult(selectedProject.id, relativePath, location)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to open search result.')
    } finally {
      setOpeningResultKey(null)
    }
  }

  const handleRevealResult = async (relativePath: string) => {
    if (!selectedProject || !onRevealResult) return
    setActionError(null)
    setRevealingResultKey(relativePath)
    try {
      await onRevealResult(selectedProject.id, relativePath)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to reveal search result.')
    } finally {
      setRevealingResultKey(null)
    }
  }

  const handleOpenTerminal = async () => {
    if (!selectedProject || !onOpenProjectTerminal || isOpeningTerminal) return
    setActionError(null)
    setIsOpeningTerminal(true)
    try {
      await onOpenProjectTerminal(selectedProject.id)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to open project terminal.')
    } finally {
      setIsOpeningTerminal(false)
    }
  }

  const handleClearSearchSession = async () => {
    if (!selectedProject || !onClearSearchSession || isClearingSearch) return
    setActionError(null)
    setIsClearingSearch(true)
    try {
      await onClearSearchSession(selectedProject.id)
      setQuery('')
      setRegex(false)
      setSearchResult(null)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to clear saved search.')
    } finally {
      setIsClearingSearch(false)
    }
  }

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Indexed Projects</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <Badge variant={engineStatus?.available ? 'secondary' : 'destructive'}>
              {engineStatus?.available ? 'Available' : 'Unavailable'}
            </Badge>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleRefreshStatus} disabled={isRefreshingStatus}>
              <RefreshCcw className={`h-4 w-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No projects added yet.
              </div>
            ) : (
              projects.map((project) => {
                const projectIndex = engineIndexes[project.id]
                const projectSession = searchSessions[project.id]
                const isActive = project.id === selectedProjectId
                return (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject?.(project.id)}
                    className={`group relative flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-accent/70 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <Badge variant={projectIndex ? 'secondary' : 'outline'} className="text-[10px] uppercase">
                          {projectIndex ? 'indexed' : 'idle'}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{projectIndex ? `${projectIndex.fileCount} files` : 'No index yet'}</span>
                        {projectSession ? (
                          <>
                            <span className="text-border">•</span>
                            <span>{projectSession.result.totalMatches} hits</span>
                            <span className="text-border">•</span>
                            <span>{formatRelativeDate(projectSession.updatedAt)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      }
      detail={
        <div className="grid h-full gap-4 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Engine</p>
                  <h2 className="mt-1 text-base font-semibold">{selectedProject?.name ?? 'No project selected'}</h2>
                </div>
                <Button className="gap-2" onClick={handleIndex} disabled={!selectedProject || !engineStatus?.available || isIndexing}>
                  <Zap className="h-4 w-4" />
                  {isIndexing ? 'Indexing...' : selectedIndex ? 'Reindex Project' : 'Index Project'}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Engine</p>
                <p className="mt-2 text-sm font-medium">{engineStatus?.available ? 'Available' : 'Unavailable'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{engineStatus?.version ?? engineStatus?.error ?? 'No version reported'}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last Indexed</p>
                <p className="mt-2 text-sm font-medium">{formatDate(selectedIndex?.lastIndexed)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Indexed Files</p>
                <p className="mt-2 text-sm font-medium">{selectedIndex?.fileCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Index Size</p>
                <p className="mt-2 text-sm font-medium">{stats ? formatBytes(stats.stats.totalSizeBytes) : isLoadingStats ? 'Loading...' : 'N/A'}</p>
              </div>
            </div>
            {error || actionError ? (
              <div className="px-4 pb-4">
                <Alert variant="destructive">
                  <AlertTitle>Engine error</AlertTitle>
                  <AlertDescription>{actionError ?? error}</AlertDescription>
                </Alert>
              </div>
            ) : null}
          </div>

          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search</p>
            </div>
            <div className="flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedSession ? 'secondary' : 'outline'}>
                  {selectedSession ? 'Saved search' : 'No saved search'}
                </Badge>
                {selectedSession ? (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatRelativeDate(selectedSession.updatedAt)}
                    </Badge>
                    <Badge variant="outline">{selectedSession.result.totalMatches} hits</Badge>
                    {selectedSession.regex ? <Badge variant="outline">Regex</Badge> : null}
                  </>
                ) : null}
                {hasDraftQueryChanges ? <Badge variant="outline">Unsaved edits</Badge> : null}
              </div>
              <div className="flex flex-col gap-3 lg:flex-row">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search indexed content"
                  disabled={!selectedProject || !selectedIndex}
                />
                <Button variant={regex ? 'secondary' : 'outline'} onClick={() => setRegex((current) => !current)}>
                  Regex {regex ? 'On' : 'Off'}
                </Button>
                <Button className="gap-2" onClick={handleSearch} disabled={!selectedProject || !selectedIndex || isSearching}>
                  <Search className="h-4 w-4" />
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={handleClearSearchSession}
                  disabled={!selectedSession || isClearingSearch}
                >
                  <Eraser className="h-4 w-4" />
                  {isClearingSearch ? 'Clearing...' : 'Clear Saved'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedIndex
                  ? `Searching ${selectedProject?.name}. Regex mode returns line-level snippets.`
                  : 'Index the selected project before searching.'}
              </p>
              {selectedSession ? (
                <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Last query:</span> {selectedSession.query}
                </div>
              ) : null}
            </div>
          </div>

          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Results</p>
                <div className="flex flex-wrap items-center gap-2">
                  {searchResult ? <Badge variant="secondary">{searchResult.totalMatches} hits</Badge> : null}
                  {searchResult ? <Badge variant="outline">{searchResult.durationMs} ms</Badge> : null}
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-3 p-4">
                {stats ? (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      Index Stats
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(stats.stats.byLanguage).map(([language, count]) => (
                        <Badge key={language} variant="outline">
                          {language}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!searchResult ? (
                  <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    {selectedSession ? 'Saved search cleared. Run a new search to populate results.' : 'Search results will appear here.'}
                  </div>
                ) : searchResult.results.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    No matches found for <span className="font-medium text-foreground">{searchResult.query}</span>.
                  </div>
                ) : (
                  searchResult.results.map((result) => (
                    <div key={result.path} className="rounded-lg border border-border/60 bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all text-sm font-medium">{result.path}</p>
                        {result.language ? <Badge variant="outline">{result.language}</Badge> : null}
                        <Badge variant="secondary">score {result.score.toFixed(3)}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => void handleOpenTerminal()}
                          disabled={!onOpenProjectTerminal || isOpeningTerminal}
                        >
                          <Terminal className="h-4 w-4" />
                          {isOpeningTerminal ? 'Opening...' : 'Terminal'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => void handleRevealResult(result.path)}
                          disabled={!onRevealResult || revealingResultKey === result.path}
                        >
                          <FolderOpen className="h-4 w-4" />
                          {revealingResultKey === result.path ? 'Revealing...' : 'Reveal'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto gap-1.5"
                          onClick={() => void handleOpenResult(result.path)}
                          disabled={!onOpenResult || openingResultKey === `${result.path}:0:0`}
                        >
                          <Code2 className="h-4 w-4" />
                          {openingResultKey === `${result.path}:0:0` ? 'Opening...' : 'Open File'}
                        </Button>
                      </div>
                      {result.matches.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {result.matches.map((match) => (
                            <div key={`${result.path}:${match.line}:${match.column}`} className="rounded-md border border-border/50 bg-card px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Line {match.line}, Column {match.column}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1.5 px-2 text-xs"
                                  onClick={() => void handleOpenResult(result.path, { line: match.line, column: match.column })}
                                  disabled={
                                    !onOpenResult ||
                                    openingResultKey === `${result.path}:${match.line}:${match.column}`
                                  }
                                >
                                  <Code2 className="h-3.5 w-3.5" />
                                  {openingResultKey === `${result.path}:${match.line}:${match.column}` ? 'Opening...' : 'Open Match'}
                                </Button>
                              </div>
                              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{match.snippet}</pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">FTS result without line-level snippets. Enable regex mode for exact match context.</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      }
    />
  )
}
  useEffect(() => {
    if (!projects.length) {
      return
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      onSelectProject?.(projects[0].id)
    }
  }, [onSelectProject, projects, selectedProjectId])
