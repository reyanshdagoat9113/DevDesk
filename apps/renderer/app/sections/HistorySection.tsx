import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText, Square, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ScrollArea } from '../components/ui/ScrollArea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Separator } from '../components/ui/Separator'
import { SectionLayout } from '../layout/SectionLayout'
import type { Command, Project, RunHistoryEntry } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

const statusStyles: Record<RunHistoryEntry['status'], string> = {
  running: 'bg-emerald-500',
  success: 'bg-sky-500',
  failed: 'bg-rose-500',
  stopped: 'bg-amber-400',
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
}: {
  history: RunHistoryEntry[]
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onStopRun?: (runId: string) => void
  onLoadOutput?: (runId: string) => Promise<string>
  onClearHistory?: () => Promise<void>
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

  const selectedEntry = useMemo(() => {
    if (!history.length) return null
    return history.find((entry) => entry.id === selectedId) ?? history[0]
  }, [history, selectedId])

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
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'Failed to clear history.')
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
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

    setOutputLoading(true)
    setOutputError(null)
    onLoadOutput(selectedEntryId)
      .then((output) => {
        setOutputText(output ?? '')
      })
      .catch((loadError) => {
        setOutputError(loadError instanceof Error ? loadError.message : 'Failed to load output.')
      })
      .finally(() => {
        setOutputLoading(false)
      })
  }, [onLoadOutput, selectedEntryId, selectedEntryOutput, selectedEntryStatus])

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
          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">History</p>
                  {hasRunning ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Stop running commands to clear history.
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={!onClearHistory || history.length === 0 || hasRunning}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  Loading runs...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                  {error}
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  No runs yet.
                </div>
              ) : (
                history.map((entry) => {
                  const isActive = selectedEntry?.id === entry.id
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                    aria-pressed={isActive}
                    className={`group relative flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0 ${
                      isActive
                        ? "bg-accent/70 text-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                        : 'hover:bg-accent/60'
                    }`}
                  >
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusStyles[entry.status]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{getCommandName(entry.commandId)}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {getProjectName(entry.projectId)} • {new Date(entry.startTime).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {entry.status}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        }
        detail={
          <div className={`${panelClass} p-5`}>
            {selectedEntry ? (
              <div className="flex h-full flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Run</p>
                  <h2 className="mt-3 text-lg font-semibold">{getCommandName(selectedEntry.commandId)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getProjectName(selectedEntry.projectId)} • {new Date(selectedEntry.startTime).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[selectedEntry.status]}`} />
                  <span className="uppercase tracking-[0.2em] text-muted-foreground">{selectedEntry.status}</span>
                  {selectedEntry.endTime ? (
                    <span className="text-muted-foreground">
                      Finished: {new Date(selectedEntry.endTime).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Output
                  </p>
                  <div className="min-h-[160px] rounded-md border border-border/60 bg-muted/40">
                    <ScrollArea className="h-40">
                      <pre className="p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {outputDisplay}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDialogOpen(true)}
                  >
                    <FileText className="h-4 w-4" />
                    View Full Output
                  </Button>
                  {selectedEntry.status === 'running' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => onStopRun?.(selectedEntry.id)}
                      disabled={!onStopRun}
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a run to see details.
              </div>
            )}
          </div>
        }
    />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run Output</DialogTitle>
            <DialogDescription>
              {selectedEntry ? `Full output for ${getCommandName(selectedEntry.commandId)} (${getProjectName(selectedEntry.projectId)})` : 'Full output'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/60">
            <ScrollArea className="h-[50vh]">
              <pre className="p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {outputDisplay}
              </pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopy} disabled={!outputText}>
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
            <Button onClick={() => setDialogOpen(false)}>Done</Button>
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
              This removes all saved runs and output. This action cannot be undone.
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
