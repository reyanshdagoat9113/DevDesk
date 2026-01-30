import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText, Square } from 'lucide-react'
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
import { SectionLayout } from '../layout/SectionLayout'
import type { RunHistoryEntry } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

const statusStyles: Record<RunHistoryEntry['status'], string> = {
  running: 'bg-emerald-500',
  success: 'bg-sky-500',
  failed: 'bg-rose-500',
  stopped: 'bg-amber-400',
}

export function HistorySection({
  history,
  isLoading,
  error,
  onStopRun,
  onLoadOutput,
}: {
  history: RunHistoryEntry[]
  isLoading?: boolean
  error?: string | null
  onStopRun?: (runId: string) => void
  onLoadOutput?: (runId: string) => Promise<string>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.id ?? null)
  const [outputText, setOutputText] = useState('')
  const [outputLoading, setOutputLoading] = useState(false)
  const [outputError, setOutputError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!history.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !history.some((entry) => entry.id === selectedId)) {
      setSelectedId(history[0].id)
    }
  }, [history, selectedId])

  const selectedEntry = useMemo(() => {
    if (!history.length) return null
    return history.find((entry) => entry.id === selectedId) ?? history[0]
  }, [history, selectedId])

  const selectedEntryId = selectedEntry?.id ?? null
  const selectedEntryOutput = selectedEntry?.output ?? ''
  const selectedEntryStatus = selectedEntry?.status

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
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">History</p>
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
                      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${
                        isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
                      }`}
                    >
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusStyles[entry.status]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Command #{entry.commandId}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {new Date(entry.startTime).toLocaleString()}
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
                  <h2 className="mt-3 text-lg font-semibold">Command #{selectedEntry.commandId}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(selectedEntry.startTime).toLocaleString()}
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
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Output</p>
                  <div className="min-h-[160px] rounded-md border border-border bg-muted/60">
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
            <DialogDescription>Full output for Command #{selectedEntry?.commandId}</DialogDescription>
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
    </>
  )
}
