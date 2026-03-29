import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Clock,
  Database,
  FileCode2,
  FileSearch,
  Flame,
  FolderOpen,
  GitBranch,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ScrollArea } from '../components/ui/ScrollArea'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type {
  EngineGitInsights,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  Project,
} from '../types'

function formatDate(value?: string) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
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

function formatRelativeTime(value?: string) {
  if (!value) return null
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

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
}

function StatCard({ label, value, subtext, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
          {subtext && (
            <p className={cn(
              "mt-0.5 text-xs",
              trend === 'up' && "text-emerald-400",
              trend === 'down' && "text-rose-400",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {subtext}
            </p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

interface LanguageBadgeProps {
  language: string
  count: number
  total: number
}

function LanguageBadge({ language, count, total }: LanguageBadgeProps) {
  const percentage = Math.round((count / total) * 100)
  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      typescript: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      javascript: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      python: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      rust: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      go: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      java: 'bg-red-500/20 text-red-400 border-red-500/30',
      html: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      css: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      json: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      markdown: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    }
    return colors[lang.toLowerCase()] || 'bg-primary/10 text-primary border-primary/20'
  }

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105",
      getLanguageColor(language)
    )}>
      <span className="capitalize">{language}</span>
      <span className="opacity-60">{count.toLocaleString()}</span>
      <span className="opacity-40">({percentage}%)</span>
    </div>
  )
}

interface SearchResultItemProps {
  result: EngineSearchResult['results'][0]
  onOpen: (path: string, location?: { line?: number; column?: number }) => void
  onReveal: (path: string) => void
  isOpening: boolean
  isRevealing: boolean
  openingKey: string | null
}

function SearchResultItem({ result, onOpen, onReveal, isOpening, isRevealing, openingKey }: SearchResultItemProps) {
  return (
    <div className="group rounded-xl border border-border/40 bg-card/20 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-primary/40 hover:bg-card/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
      {/* File Header */}
      <div className="flex items-center gap-3 border-b border-border/30 bg-gradient-to-r from-card/60 to-transparent px-4 py-3">
        <FileCode2 className="h-4 w-4 text-primary/70 drop-shadow-sm" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground/90">{result.path}</p>
        </div>
        {result.language && (
          <Badge variant="secondary" className="text-[10px] uppercase tracking-widest bg-background/50 border-border/50">
            {result.language}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground/80 border-border/40">
          {result.score.toFixed(2)}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-background/80 hover:text-primary transition-colors"
            onClick={() => onReveal(result.path)}
            disabled={isRevealing}
            title="Reveal in folder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-background/80 hover:text-primary transition-colors"
            onClick={() => onOpen(result.path)}
            disabled={isOpening}
            title="Open file"
          >
            {openingKey === `${result.path}:0:0` ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSearch className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Matches */}
      {result.matches.length > 0 && (
        <div className="divide-y divide-border/20">
          {result.matches.map((match, idx) => (
            <div
              key={`${match.line}:${match.column}:${idx}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-primary/10 transition-colors duration-200 cursor-pointer"
              onClick={() => onOpen(result.path, { line: match.line, column: match.column })}
            >
              <div className="flex flex-col items-end gap-0.5 min-w-[3rem]">
                <span className="text-[11px] font-mono font-medium text-primary/70">L{match.line}</span>
                <span className="text-[10px] font-mono text-muted-foreground/50">C{match.column}</span>
              </div>
              <div className="flex-1 min-w-0 rounded bg-background/30 p-2 border border-border/20">
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                  {match.snippet}
                </pre>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 self-center">
                {openingKey === `${result.path}:${match.line}:${match.column}` ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <FileSearch className="h-4 w-4 text-muted-foreground/50 hover:text-primary transition-colors" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
  onLoadGitInsights,
  onOpenResult,
  onRevealResult,
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
  onIndexProject?: (projectId: string) => Promise<unknown>
  onSearch?: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadStats?: (projectId: string) => Promise<EngineStats>
  onLoadGitInsights?: (projectId: string) => Promise<EngineGitInsights>
  onOpenResult?: (projectId: string, relativePath: string, location?: { line?: number; column?: number }) => Promise<void>
  onRevealResult?: (projectId: string, relativePath: string) => Promise<void>
  onClearSearchSession?: (projectId: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [searchResult, setSearchResult] = useState<EngineSearchResult | null>(null)
  const [stats, setStats] = useState<EngineStats | null>(null)
  const [gitInsights, setGitInsights] = useState<EngineGitInsights | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isLoadingGitInsights, setIsLoadingGitInsights] = useState(false)
  const [openingResultKey, setOpeningResultKey] = useState<string | null>(null)
  const [revealingResultKey, setRevealingResultKey] = useState<string | null>(null)
  const [showRegexInfo, setShowRegexInfo] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedIndex = selectedProject ? engineIndexes[selectedProject.id] ?? null : null
  const selectedSession = selectedProject ? searchSessions[selectedProject.id] ?? null : null

  useEffect(() => {
    if (!projects.length) return
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      onSelectProject?.(projects[0].id)
    }
  }, [onSelectProject, projects, selectedProjectId])

  useEffect(() => {
    setActionError(null)
    setQuery(selectedSession?.query ?? '')
    setRegex(selectedSession?.regex ?? false)
    setSearchResult(selectedSession?.result ?? null)
  }, [selectedProjectId, selectedSession])

  useEffect(() => {
    if (!selectedProject || !selectedIndex || !onLoadStats) {
      setStats(null)
      return
    }

    let cancelled = false
    setIsLoadingStats(true)
    onLoadStats(selectedProject.id)
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStats(false)
      })

    return () => { cancelled = true }
  }, [onLoadStats, selectedIndex?.lastIndexed, selectedProject])

  useEffect(() => {
    if (!selectedProject || !onLoadGitInsights) {
      setGitInsights(null)
      return
    }

    let cancelled = false
    setIsLoadingGitInsights(true)
    onLoadGitInsights(selectedProject.id)
      .then((result) => {
        if (!cancelled) setGitInsights(result)
      })
      .catch(() => {
        if (!cancelled) setGitInsights(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGitInsights(false)
      })

    return () => { cancelled = true }
  }, [onLoadGitInsights, selectedProject])

  const handleRefreshStatus = async () => {
    if (!onRefreshStatus || isRefreshingStatus) return
    setActionError(null)
    setIsRefreshingStatus(true)
    try {
      await onRefreshStatus()
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to refresh status')
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
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to index project')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSearch = async () => {
    if (!selectedProject || !onSearch || isSearching || !engineStatus?.available) return
    const trimmed = query.trim()
    if (!trimmed) {
      setActionError('Enter a search query')
      return
    }

    setActionError(null)
    setIsSearching(true)
    try {
      const result = await onSearch(selectedProject.id, trimmed, { regex, limit: 50 })
      setSearchResult(result)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSearch()
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
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to open file')
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
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to reveal file')
    } finally {
      setRevealingResultKey(null)
    }
  }

  const handleClearSearch = async () => {
    if (!selectedProject || !onClearSearchSession) return
    setActionError(null)
    try {
      await onClearSearchSession(selectedProject.id)
      setQuery('')
      setRegex(false)
      setSearchResult(null)
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Failed to clear search')
    }
  }

  const totalFiles = stats?.stats.totalFiles ?? selectedIndex?.fileCount ?? 0
  const languageEntries = stats ? Object.entries(stats.stats.byLanguage).sort((a, b) => b[1] - a[1]) : []

  return (
    <SectionLayout
      list={
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm">
          {/* Header */}
          <div className="border-b border-border/50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex h-2 w-2 rounded-full",
                  engineStatus?.available ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-rose-500"
                )} />
                <span className="text-xs font-medium text-muted-foreground">
                  {engineStatus?.available ? 'Engine Ready' : 'Engine Offline'}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingStatus && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Project List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : projects.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <Layers className="h-8 w-8 opacity-50" />
                  <p>No projects yet</p>
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
                      className={cn(
                        "group w-full rounded-xl border p-3 text-left transition-all duration-200",
                        isActive
                          ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/5"
                          : "border-transparent hover:border-border/50 hover:bg-card/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        )}>
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{project.name}</p>
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{project.path}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {projectIndex ? (
                              <Badge variant="outline" className="h-5 text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                <Database className="mr-1 h-3 w-3" />
                                {projectIndex.fileCount.toLocaleString()} files
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                Not indexed
                              </Badge>
                            )}
                            {projectSession && (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                <Search className="mr-1 h-3 w-3" />
                                {projectSession.result.totalMatches} hits
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer Info */}
          {engineStatus?.version && (
            <div className="border-t border-border/50 px-4 py-2">
              <p className="text-[10px] text-muted-foreground/60">
                Engine v{engineStatus.version}
              </p>
            </div>
          )}
        </div>
      }
      detail={
        <div className="flex h-full flex-col gap-4">
          {/* Error Banner */}
          {(error || actionError) && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4" />
                {actionError ?? error}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Status"
              value={selectedIndex ? 'Indexed' : 'Not Indexed'}
              subtext={selectedIndex ? formatRelativeTime(selectedIndex.lastIndexed) || formatDate(selectedIndex.lastIndexed) : 'Click to index'}
              icon={selectedIndex ? Zap : Database}
              trend={selectedIndex ? 'up' : 'neutral'}
            />
            <StatCard
              label="Files"
              value={totalFiles.toLocaleString()}
              subtext={stats ? `${Object.keys(stats.stats.byLanguage).length} languages` : 'Loading...'}
              icon={Layers}
              trend="neutral"
            />
            <StatCard
              label="Index Size"
              value={stats ? formatBytes(stats.stats.totalSizeBytes) : isLoadingStats ? '...' : 'N/A'}
              subtext={selectedIndex ? 'SQLite + FTS5' : 'Not created'}
              icon={Database}
              trend="neutral"
            />
            <StatCard
              label="Git Activity"
              value={gitInsights ? `${gitInsights.totalCommits}` : isLoadingGitInsights ? '...' : 'N/A'}
              subtext={gitInsights ? `${gitInsights.contributors.length} contributors` : 'No data'}
              icon={GitBranch}
              trend="neutral"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px] min-h-0">
            {/* Left Column - Search & Results */}
            <div className="flex min-h-0 flex-col gap-4">
              {/* Search Bar */}
              <div className="rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedIndex ? `Search ${selectedProject?.name}...` : 'Index project to search'}
                      disabled={!selectedProject || !engineStatus?.available || !selectedIndex}
                      className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <Button
                    variant={regex ? 'default' : 'outline'}
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => setRegex(!regex)}
                    disabled={!selectedProject || !engineStatus?.available}
                    onMouseEnter={() => setShowRegexInfo(true)}
                    onMouseLeave={() => setShowRegexInfo(false)}
                  >
                    <span className="text-xs font-mono font-bold">.*</span>
                  </Button>

                  <Button
                    className="h-11 gap-2 px-6"
                    onClick={handleSearch}
                    disabled={!selectedProject || !engineStatus?.available || isSearching || !selectedIndex}
                  >
                    {isSearching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Search
                  </Button>

                  {!selectedIndex && selectedProject && (
                    <Button
                      className="h-11 gap-2"
                      onClick={handleIndex}
                      disabled={!engineStatus?.available || isIndexing}
                    >
                      {isIndexing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Index
                    </Button>
                  )}
                </div>

                {/* Search Meta */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedSession ? (
                      <>
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="mr-1 h-3 w-3" />
                          {formatRelativeTime(selectedSession.updatedAt)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {selectedSession.result.totalMatches} matches
                        </Badge>
                        {selectedSession.regex && (
                          <Badge variant="outline" className="text-[10px]">Regex</Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {selectedProject ? `Search in ${selectedProject.name}` : 'Select a project to search'}
                      </span>
                    )}
                  </div>

                  {selectedSession && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleClearSearch}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Regex Tooltip */}
                {showRegexInfo && regex && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Regex mode enabled - searches will use pattern matching
                  </div>
                )}
              </div>

              {/* Search Results */}
              <div className="flex-1 min-h-0 rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Results</span>
                    {searchResult && (
                      <Badge variant="secondary" className="text-[10px]">
                        {searchResult.results.length} files
                      </Badge>
                    )}
                  </div>
                  {searchResult && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{searchResult.totalMatches} total matches</span>
                      <span className="text-border">•</span>
                      <span>{searchResult.durationMs}ms</span>
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[calc(100%-49px)]">
                  <div className="p-4 space-y-3">
                    {!searchResult ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                        <Search className="h-12 w-12 opacity-20" />
                        <div>
                          <p className="text-sm font-medium">No search yet</p>
                          <p className="text-xs">Enter a query and hit search to find files</p>
                        </div>
                      </div>
                    ) : searchResult.results.length === 0 ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                        <X className="h-12 w-12 opacity-20" />
                        <div>
                          <p className="text-sm font-medium">No matches found</p>
                          <p className="text-xs">Try a different query or check your regex</p>
                        </div>
                      </div>
                    ) : (
                      searchResult.results.map((result) => (
                        <SearchResultItem
                          key={result.path}
                          result={result}
                          onOpen={handleOpenResult}
                          onReveal={handleRevealResult}
                          isOpening={!!openingResultKey}
                          isRevealing={!!revealingResultKey}
                          openingKey={openingResultKey}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Right Column - Insights */}
            <div className="flex min-h-0 flex-col gap-4">
              {/* Language Distribution */}
              <div className="rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden">
                <div className="border-b border-border/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Languages</span>
                  </div>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-3 space-y-2">
                    {languageEntries.length > 0 ? (
                      languageEntries.map(([language, count]) => (
                        <LanguageBadge
                          key={language}
                          language={language}
                          count={count}
                          total={totalFiles}
                        />
                      ))
                    ) : (
                      <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">
                        Index project to see language stats
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Git Insights */}
              <div className="flex-1 min-h-0 rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden">
                <div className="border-b border-border/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Git Insights</span>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100%-49px)]">
                  <div className="p-4 space-y-4">
                    {gitInsights ? (
                      <>
                        {/* Branch & Stats */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-card/50 p-3 text-center">
                            <GitBranch className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                            <p className="text-xs font-medium truncate">{gitInsights.branch || 'detached'}</p>
                          </div>
                          <div className="rounded-lg bg-card/50 p-3 text-center">
                            <Activity className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                            <p className="text-xs font-medium">{gitInsights.totalCommits} commits</p>
                          </div>
                        </div>

                        {/* Contributors */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Top Contributors</p>
                          <div className="space-y-1.5">
                            {gitInsights.contributors.slice(0, 5).map((contributor) => (
                              <div key={contributor} className="flex items-center justify-between rounded-lg bg-card/30 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{contributor}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  author
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Hotspots */}
                        {gitInsights.hotspots.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Hotspots</p>
                            <div className="space-y-1.5">
                              {gitInsights.hotspots.slice(0, 3).map((hotspot) => (
                                <div
                                  key={hotspot.path}
                                  className="rounded-lg border border-border/30 bg-card/30 px-3 py-2 cursor-pointer hover:bg-card/50 transition-colors"
                                  onClick={() => handleOpenResult(hotspot.path)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-[11px] font-medium">{hotspot.path}</p>
                                    <Badge
                                      variant={hotspot.risk === 'high' ? 'destructive' : hotspot.risk === 'medium' ? 'default' : 'outline'}
                                      className="text-[9px] h-4"
                                    >
                                      {hotspot.risk}
                                    </Badge>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <Flame className="h-3 w-3" />
                                    {hotspot.commits} commits
                                    <span className="text-border">•</span>
                                    {hotspot.recency}d ago
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <GitBranch className="h-8 w-8 opacity-30" />
                        <p className="text-xs">Git insights unavailable</p>
                        <p className="text-[10px]">Ensure this is a git repository</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      }
    />
  )
}
