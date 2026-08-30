import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, FileText, Square, Trash2, History as HistoryIcon, Terminal, Search, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ScrollArea } from '../components/ui/ScrollArea'
import {
  Card,
  CardHeader,
  CardTitle,
} from '../components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type { Command, Project, RunHistoryEntry } from '../types'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusNotice } from '../components/ui/StatusNotice'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { selectClass } from './projectsSectionConfig'
import {
  filterAndSortHistory,
  formatRunDuration,
  formatRunExitCode,
  getFailureSummary,
  getRunDurationMs,
  type HistoryDateFilter,
  type HistorySort,
} from './historyUtils'

const statusStyles: Record<RunHistoryEntry['status'], string> = {
  running: 'bg-status-success',
  success: 'bg-status-info',
  failed: 'bg-status-error',
  stopped: 'bg-status-warning',
}

const statusTextColors: Record<RunHistoryEntry['status'], string> = {
  running: 'text-status-success',
  success: 'text-status-info',
  failed: 'text-status-error',
  stopped: 'text-status-warning',
}

export function HistorySection({
  history,
  commands,
  projects,
  isLoading,
  error,
  onStopRun,
  onLoadOutput,
  onClearHistory,
  onRemoveEntry,
  onLoadMore,
  hasMore,
  initialRunId,
  onOpenCommands,
}: {
  history: RunHistoryEntry[]
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onStopRun?: (runId: string) => Promise<void> | void
  onLoadOutput?: (runId: string) => Promise<string>
  onClearHistory?: () => Promise<void>
  onRemoveEntry?: (runId: string) => Promise<void>
  onLoadMore?: () => Promise<void> | void
  hasMore?: boolean
  initialRunId?: string | null
  onOpenCommands?: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.id ?? null)
  const [outputText, setOutputText] = useState('')
  const [outputLoading, setOutputLoading] = useState(false)
  const [outputError, setOutputError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)
  const [stopMessage, setStopMessage] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const [clearMessage, setClearMessage] = useState<string | null>(null)
  const [removeMessage, setRemoveMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<RunHistoryEntry['status'] | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('all')
  const [sort, setSort] = useState<HistorySort>('newest')
  const [loadingMore, setLoadingMore] = useState(false)
  const appliedInitialRunId = useRef<string | null>(null)
  const outputRequestRef = useRef(0)

  useEffect(() => {
    if (initialRunId && initialRunId !== appliedInitialRunId.current && history.some((entry) => entry.id === initialRunId)) {
      setSelectedId(initialRunId)
      appliedInitialRunId.current = initialRunId
    }
    if (!initialRunId) appliedInitialRunId.current = null
  }, [history, initialRunId])

  useEffect(() => {
    if (!history.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !history.some((entry) => entry.id === selectedId)) {
      setSelectedId(history[0].id)
    }
  }, [history, selectedId])

  const commandById = useMemo(() => {
    return commands.reduce<Record<string, Command>>((acc, command) => {
      acc[command.id] = command
      return acc
    }, {})
  }, [commands])

  const projectById = useMemo(() => {
    return projects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project
      return acc
    }, {})
  }, [projects])

  const visibleHistory = useMemo(
    () => filterAndSortHistory(history, {
      query,
      projectId: projectFilter,
      status: statusFilter,
      date: dateFilter,
      sort,
      commandsById: commandById,
      projectsById: projectById,
    }),
    [commandById, dateFilter, history, projectById, projectFilter, query, sort, statusFilter],
  )

  useEffect(() => {
    if (visibleHistory.length > 0 && (!selectedId || !visibleHistory.some((entry) => entry.id === selectedId))) {
      setSelectedId(visibleHistory[0].id)
    }
  }, [selectedId, visibleHistory])

  const selectedEntry = useMemo(() => {
    if (!visibleHistory.length) return null
    return visibleHistory.find((entry) => entry.id === selectedId) ?? visibleHistory[0]
  }, [selectedId, visibleHistory])

  const getCommandName = (commandId: string): string => {
    return commandById[commandId]?.name ?? 'Removed command'
  }

  const getProjectName = (projectId?: string): string => {
    if (!projectId) return 'Global'
    return projectById[projectId]?.name ?? 'Removed project'
  }

  const selectedEntryId = selectedEntry?.id ?? null
  const selectedEntryOutput = selectedEntry?.output ?? ''
  const selectedEntryStatus = selectedEntry?.status
  const hasRunning = history.some((entry) => entry.status === 'running')

  const handleClearHistory = async () => {
    if (!onClearHistory || clearing) return
    setClearError(null)
    setClearing(true)
    try {
      await onClearHistory()
      setClearDialogOpen(false)
      setClearMessage(`Cleared ${history.length} saved run${history.length === 1 ? '' : 's'} and captured output.`)
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'Failed to clear history.')
    } finally {
      setClearing(false)
    }
  }

  const handleRemoveSelectedEntry = async () => {
    if (!selectedEntryId || !onRemoveEntry || removing) return
    setRemoveError(null)
    setRemoving(true)
    try {
      await onRemoveEntry(selectedEntryId)
      setRemoveDialogOpen(false)
      setRemoveMessage(`Removed the ${getCommandName(selectedEntry?.commandId ?? '')} run.`)
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Failed to remove history entry.')
    } finally {
      setRemoving(false)
    }
  }

  const loadOutput = useCallback(async (runId: string) => {
    if (!onLoadOutput) return
    const requestId = ++outputRequestRef.current
    setOutputLoading(true)
    setOutputError(null)
    try {
      const output = await onLoadOutput(runId)
      if (requestId !== outputRequestRef.current) return
      setOutputText(output ?? '')
    } catch (loadError) {
      if (requestId !== outputRequestRef.current) return
      setOutputError(loadError instanceof Error ? loadError.message : 'Failed to load output.')
    } finally {
      if (requestId === outputRequestRef.current) setOutputLoading(false)
    }
  }, [onLoadOutput])

  useEffect(() => {
    outputRequestRef.current += 1
    if (!selectedEntryId) {
      setOutputText('')
      setOutputError(null)
      setOutputLoading(false)
      return
    }

    if (selectedEntryOutput) {
      setOutputText(selectedEntryOutput)
      setOutputError(null)
      setOutputLoading(false)
      return
    }

    if (!onLoadOutput || selectedEntryStatus === 'running') {
      setOutputText(selectedEntryOutput)
      setOutputError(null)
      setOutputLoading(false)
      return
    }

    void loadOutput(selectedEntryId)

  }, [loadOutput, onLoadOutput, selectedEntryId, selectedEntryOutput, selectedEntryStatus])

  const handleStopSelected = async () => {
    if (!selectedEntryId || !onStopRun || stopping) return
    setStopping(true)
    setStopError(null)
    setStopMessage(null)
    try {
      await onStopRun(selectedEntryId)
      setStopMessage(`Termination requested for ${getCommandName(selectedEntry?.commandId ?? '')}.`)
    } catch (stopFailure) {
      setStopError(stopFailure instanceof Error ? stopFailure.message : 'Failed to terminate the run.')
    } finally {
      setStopping(false)
    }
  }

  const handleLoadMore = async () => {
    if (!onLoadMore || loadingMore) return
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  const handleCopy = async () => {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const outputDisplay = outputLoading
    ? 'Loading output...'
    : outputError
      ? outputError
      : outputText || 'No output captured yet.'

  return (
    <>
      <SectionLayout
        list={
          <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {visibleHistory.length} of {history.length} runs
                  </p>
                  {hasRunning && (
                    <p className="mt-1 text-[10px] text-muted-foreground animate-pulse">
                      Running commands...
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1.5 px-2 text-[10px]"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={!onClearHistory || history.length === 0 || hasRunning}
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    aria-label="Search history"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search command, project, or failure..."
                    className="h-8 pl-8 text-xs bg-background/50"
                  />
                </div>
                <select
                  aria-label="Filter history by status"
                  className={cn(selectClass, 'h-8 min-w-[120px] text-xs')}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="running">Running</option>
                  <option value="success">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="stopped">Stopped</option>
                </select>
                <select
                  aria-label="Sort history"
                  className={cn(selectClass, 'h-8 min-w-[132px] text-xs')}
                  value={sort}
                  onChange={(event) => setSort(event.target.value as HistorySort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="duration">Longest first</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter history by project"
                  className={cn(selectClass, 'h-7 min-w-[150px] text-[11px]')}
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <select
                  aria-label="Filter history by date"
                  className={cn(selectClass, 'h-7 min-w-[120px] text-[11px]')}
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as HistoryDateFilter)}
                >
                  <option value="all">Any date</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
                {(query || projectFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || sort !== 'newest') ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      setQuery('')
                      setProjectFilter('all')
                      setStatusFilter('all')
                      setDateFilter('all')
                      setSort('newest')
                    }}
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
             </div>
             {clearMessage ? <StatusNotice tone="success" title="History cleared" className="mx-2 mt-2">{clearMessage} Copy any output you need before clearing future runs.</StatusNotice> : null}
             {removeMessage ? <StatusNotice tone="success" title="Run removed" className="mx-2 mt-2">{removeMessage}</StatusNotice> : null}
             <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <LoadingState label="Loading execution history" description="Loading execution logs…" className="h-full" />
              ) : error ? (
                <ErrorState title="Could not load history" description={error} className="h-full" />
              ) : history.length === 0 ? (
                <EmptyState
                  className="h-full"
                  icon={<HistoryIcon className="h-5 w-5" />}
                  title="No execution history yet"
                  description="Run a saved command to see its output, duration, and result here."
                  action={onOpenCommands ? <Button size="sm" onClick={onOpenCommands}>Go to Commands</Button> : undefined}
                />
              ) : visibleHistory.length === 0 ? (
                <EmptyState
                  className="h-full"
                  icon={<Search className="h-5 w-5" />}
                  title="No runs match these filters"
                  description="Try a broader command, project, date, or status filter."
                  action={<Button size="sm" variant="outline" onClick={() => { setQuery(''); setProjectFilter('all'); setStatusFilter('all'); setDateFilter('all'); setSort('newest') }}>Clear filters</Button>}
                />
              ) : (
                <div className="space-y-1">
                  {visibleHistory.map((entry) => {
                    const isActive = selectedEntry?.id === entry.id
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        className={cn(
                          "group flex w-full flex-col gap-1 rounded-lg px-3 py-3 text-left transition-all",
                          isActive 
                            ? "border border-primary/15 bg-primary/10 text-foreground"
                            : "border border-transparent hover:bg-muted/50"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className={cn(
                            "truncate text-sm font-bold leading-none",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {getCommandName(entry.commandId)}
                          </span>
                          <span className={cn("h-2 w-2 rounded-full shrink-0", statusStyles[entry.status])} />
                        </div>
                        <div className="flex w-full items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                          <span className="truncate">{getProjectName(entry.projectId)}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span>{formatRunDuration(getRunDurationMs(entry))}</span>
                            <span>{new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </div>
                        <p className={cn('truncate text-[10px]', entry.status === 'failed' ? 'text-status-error/90' : 'text-muted-foreground/70')}>
                          {getFailureSummary(entry)}
                        </p>
                      </button>
                    )
                  })}
                  {hasMore && onLoadMore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={loadingMore}
                      onClick={() => void handleLoadMore()}
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedEntry ? (
          <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-muted/20 border border-border/40 text-muted-foreground">
                        <Terminal className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-2xl font-bold tracking-tight truncate">{getCommandName(selectedEntry.commandId)}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono bg-muted/20 w-fit px-2 py-0.5 rounded border border-border/20 text-muted-foreground">
                      <span>{getProjectName(selectedEntry.projectId)}</span>
                      <span className="opacity-30" aria-hidden="true">·</span>
                      <span>{new Date(selectedEntry.startTime).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusStyles[selectedEntry.status])} />
                      <span className={statusTextColors[selectedEntry.status]}>
                        {selectedEntry.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground">
                      <span>Duration: {formatRunDuration(getRunDurationMs(selectedEntry))}</span>
                      <span>Exit code: {formatRunExitCode(selectedEntry)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <div className={cn(
                'border-b border-border/40 px-5 py-3 text-xs',
                selectedEntry.status === 'failed' ? 'bg-status-error/5 text-status-error' : 'bg-muted/10 text-muted-foreground',
              )}>
                <span className="mr-2 font-semibold">Summary</span>
                {getFailureSummary(selectedEntry)}
              </div>

              {/* Resolved Command Display */}
              {selectedEntry.resolvedCommand && (
                <div className="px-5 py-2.5 bg-muted/10 border-b border-border/40">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Executed Command</div>
                  <code className="block font-mono text-[11px] text-foreground/80 whitespace-pre-wrap break-all">
                    {selectedEntry.resolvedCommand}
                  </code>
                </div>
              )}

              <div className="relative flex min-h-0 flex-1 flex-col bg-code group/terminal">
                <div className="flex items-center justify-between border-b border-code-border bg-code-foreground/5 px-5 py-2.5 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full border border-status-error/40 bg-status-error/20" />
                      <div className="h-2.5 w-2.5 rounded-full border border-status-warning/40 bg-status-warning/20" />
                      <div className="h-2.5 w-2.5 rounded-full border border-status-success/40 bg-status-success/20" />
                    </div>
                    <span className="ml-2 font-mono text-[11px] font-medium uppercase tracking-wider text-code-foreground/50">Standard Output</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-40 group-hover/terminal:opacity-100 transition-opacity">
                     <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-code-foreground/70 hover:bg-code-foreground/10 hover:text-code-foreground"
                      onClick={() => setDialogOpen(true)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Full Screen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-code-foreground/70 hover:bg-code-foreground/10 hover:text-code-foreground"
                      onClick={handleCopy}
                      disabled={!outputText}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy log'}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <pre className="whitespace-pre-wrap break-words font-mono text-ui-code leading-relaxed text-code-foreground selection:bg-primary/30 selection:text-foreground">
                      <span className="mr-2 select-none text-status-success/60">$</span>
                      {outputDisplay}
                      {selectedEntry.status === 'running' && <span className="inline-block w-2 h-4 ml-1 bg-white/20 animate-pulse align-middle" />}
                    </pre>
                  </div>
                </ScrollArea>
              </div>

              <div className="border-t border-border/40 bg-muted/5 p-5">
                <div className="flex justify-end gap-2">
                  {selectedEntry.status === 'running' ? (
                    <Button
                      variant="destructive"
                      className="h-9 px-6 gap-2 font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-destructive/10"
                      onClick={() => void handleStopSelected()}
                      disabled={!onStopRun || stopping}
                    >
                      <Square className="h-4 w-4" />
                      {stopping ? 'Terminating…' : 'Terminate Run'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => setRemoveDialogOpen(true)}
                      disabled={!onRemoveEntry}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Purge entry
                    </Button>
                  )}
                </div>
                {outputLoading ? <StatusNotice tone="info" title="Loading output">Retrieving captured output…</StatusNotice> : null}
                {outputError ? (
                  <StatusNotice
                    tone="error"
                    title="Output could not be loaded"
                    action={<Button size="sm" variant="outline" onClick={() => selectedEntryId && void loadOutput(selectedEntryId)}>Retry</Button>}
                  >
                    {outputError}
                  </StatusNotice>
                ) : null}
                {stopError ? <StatusNotice tone="error" title="Run was not terminated">{stopError}</StatusNotice> : null}
                {stopMessage ? <StatusNotice tone="success" title="Termination requested">{stopMessage}</StatusNotice> : null}
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-0 bg-transparent p-12 text-center shadow-none">
              <div className="max-w-[240px] space-y-4 opacity-40">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                  <HistoryIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Run History</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Select a completed or active run from the ledger to inspect console output and termination status.</p>
                </div>
              </div>
            </Card>
          )
        }
    />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex h-[80vh] max-w-4xl flex-col gap-0 overflow-hidden bg-code p-0">
          <DialogHeader className="px-6 py-4 bg-muted/10 border-b border-border/10">
            <DialogTitle className="text-foreground">Run Output</DialogTitle>
            <DialogDescription>
              {selectedEntry ? `Full output for ${getCommandName(selectedEntry.commandId)}` : 'Full output'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
             <pre className="font-mono text-sm text-muted-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                {outputDisplay}
              </pre>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 bg-muted/5 border-t border-border/10">
            <Button variant="secondary" onClick={handleCopy} disabled={!outputText}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Output
                </>
              )}
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open)
          if (!open) {
            setRemoveError(null)
            setRemoving(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove selected run?</DialogTitle>
            <DialogDescription>
              This removes only the selected run and its captured output. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {removeError ? (
            <p className="text-xs text-destructive">{removeError}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveSelectedEntry} disabled={removing || !selectedEntryId}>
              {removing ? 'Removing...' : 'Remove Run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={clearDialogOpen}
        onOpenChange={(open) => {
          setClearDialogOpen(open)
          if (!open) {
            setClearError(null)
            setClearing(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear command history?</DialogTitle>
            <DialogDescription>
              This permanently removes all {history.length} saved run{history.length === 1 ? '' : 's'} and their captured output. Running commands are not included and must finish first. Copy any output you need before continuing.
            </DialogDescription>
          </DialogHeader>
          {clearError ? (
            <p className="text-xs text-destructive">{clearError}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearHistory} disabled={clearing}>
              {clearing ? 'Clearing...' : 'Clear History'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
