import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText, Square, Trash2, Clock, Terminal } from 'lucide-react'
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

const statusStyles: Record<RunHistoryEntry['status'], string> = {
  running: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  success: 'bg-blue-500',
  failed: 'bg-rose-500',
  stopped: 'bg-amber-400',
}

const statusTextColors: Record<RunHistoryEntry['status'], string> = {
  running: 'text-emerald-500',
  success: 'text-blue-500',
  failed: 'text-rose-500',
  stopped: 'text-amber-500',
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
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</p>
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
            </div>
            <div className="flex-1 overflow-auto p-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading runs...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center text-sm text-destructive">
                  {error}
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No runs yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((entry) => {
                    const isActive = selectedEntry?.id === entry.id
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        className={cn(
                          "group flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-all",
                          isActive 
                            ? "bg-primary/10 shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className={cn(
                            "truncate text-sm font-medium",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {getCommandName(entry.commandId)}
                          </span>
                          <span className={cn("h-2 w-2 rounded-full", statusStyles[entry.status])} />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground/70">{getProjectName(entry.projectId)}</span>
                          <span className="text-muted-foreground/50 font-mono">
                            {new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedEntry ? (
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{getCommandName(selectedEntry.commandId)}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getProjectName(selectedEntry.projectId)}</span>
                      <span>•</span>
                      <span className="font-mono">{new Date(selectedEntry.startTime).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-2 py-0.5 text-xs font-medium">
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusStyles[selectedEntry.status])} />
                      <span className={cn("uppercase tracking-wider text-[10px]", statusTextColors[selectedEntry.status])}>
                        {selectedEntry.status}
                      </span>
                    </div>
                    {selectedEntry.endTime && (
                      <span className="text-[10px] text-muted-foreground">
                        Finished: {new Date(selectedEntry.endTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d]">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/5 border-b border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    <span className="text-xs font-mono uppercase tracking-wider opacity-70">Console Output</span>
                  </div>
                  <div className="flex items-center gap-1">
                     <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/5"
                      onClick={() => setDialogOpen(true)}
                    >
                      <FileText className="h-3 w-3" />
                      Expand
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/5"
                      onClick={handleCopy}
                      disabled={!outputText}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    <pre className="font-mono text-xs text-muted-foreground/90 whitespace-pre-wrap break-words leading-relaxed selection:bg-primary/30 selection:text-primary-foreground">
                      {outputDisplay}
                    </pre>
                  </div>
                </ScrollArea>
              </div>

              <div className="border-t border-border/40 bg-muted/10 p-4">
                <div className="flex justify-end gap-2">
                  {selectedEntry.status === 'running' && (
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => onStopRun?.(selectedEntry.id)}
                      disabled={!onStopRun}
                    >
                      <Square className="h-4 w-4" />
                      Stop Execution
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 bg-card/50 p-6 text-center shadow-sm">
              <div className="space-y-2">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-lg font-medium">No run selected</h3>
                <p className="text-sm text-muted-foreground">Select a run from history to view output.</p>
              </div>
            </Card>
          )
        }
    />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#0d0d0d] border-border/20">
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
