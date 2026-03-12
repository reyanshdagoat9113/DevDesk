import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText, Square, Trash2, History as HistoryIcon, Terminal } from 'lucide-react'
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
  onRemoveEntry,
}: {
  history: RunHistoryEntry[]
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onStopRun?: (runId: string) => void
  onLoadOutput?: (runId: string) => Promise<string>
  onClearHistory?: () => Promise<void>
  onRemoveEntry?: (runId: string) => Promise<void>
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

  const handleRemoveSelectedEntry = async () => {
    if (!selectedEntryId || !onRemoveEntry || removing) return
    setRemoveError(null)
    setRemoving(true)
    try {
      await onRemoveEntry(selectedEntryId)
      setRemoveDialogOpen(false)
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Failed to remove history entry.')
    } finally {
      setRemoving(false)
    }
  }

  useEffect(() => {
    let cancelled = false

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
        if (!cancelled) {
          setOutputText(output ?? '')
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setOutputError(loadError instanceof Error ? loadError.message : 'Failed to load output.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOutputLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
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
            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                  Loading execution logs...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/10">
                  {error}
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                  <HistoryIcon className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No execution history yet.</p>
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
                          "group flex w-full flex-col gap-1 rounded-lg px-3 py-3 text-left transition-all",
                          isActive 
                            ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20" 
                            : "hover:bg-muted/50"
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
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-tighter opacity-60">
                          <span className="truncate">{getProjectName(entry.projectId)}</span>
                          <span className="shrink-0">
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
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
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
                      <span className="opacity-30">•</span>
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
                    {selectedEntry.endTime && (
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                        Duration: {Math.round((new Date(selectedEntry.endTime).getTime() - new Date(selectedEntry.startTime).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Resolved Command Display */}
              {selectedEntry.resolvedCommand && (
                <div className="px-5 py-2.5 bg-muted/10 border-b border-border/40">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Executed Command</div>
                  <code className="block font-mono text-[11px] text-foreground/80 whitespace-pre-wrap break-all">
                    {selectedEntry.resolvedCommand}
                  </code>
                </div>
              )}

              <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a] relative group/terminal">
                <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 border-b border-white/5 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-rose-500/20 border border-rose-500/40" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 font-bold ml-2">Standard Output</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-40 group-hover/terminal:opacity-100 transition-opacity">
                     <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10"
                      onClick={() => setDialogOpen(true)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Full Screen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-2 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10"
                      onClick={handleCopy}
                      disabled={!outputText}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy log'}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <pre className="font-mono text-[12px] text-blue-100/80 whitespace-pre-wrap break-words leading-relaxed selection:bg-primary/30 selection:text-white">
                      <span className="text-emerald-500/50 mr-2 select-none">$</span>
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
                      onClick={() => onStopRun?.(selectedEntry.id)}
                      disabled={!onStopRun}
                    >
                      <Square className="h-4 w-4" />
                      Terminate Run
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
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center shadow-sm">
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
