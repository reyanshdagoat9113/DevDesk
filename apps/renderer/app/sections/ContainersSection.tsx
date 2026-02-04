import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Square, Power, Logs } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ScrollArea } from '../components/ui/ScrollArea'
import { Separator } from '../components/ui/Separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { SectionLayout } from '../layout/SectionLayout'
import type { Container } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

const statusStyles: Record<Container['state'], string> = {
  running: 'bg-emerald-500',
  stopped: 'bg-muted-foreground/60',
  paused: 'bg-amber-400',
}

export function ContainersSection({
  containers,
  isLoading,
  error,
  onStartContainer,
  onStopContainer,
  onViewLogs,
}: {
  containers: Container[]
  isLoading?: boolean
  error?: string | null
  onStartContainer?: (containerId: string) => void
  onStopContainer?: (containerId: string) => void
  onViewLogs?: (containerId: string) => Promise<string>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(containers[0]?.id ?? null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsText, setLogsText] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!containers.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !containers.some((container) => container.id === selectedId)) {
      setSelectedId(containers[0].id)
    }
  }, [containers, selectedId])

  const selectedContainer = useMemo(() => {
    if (!containers.length) return null
    return containers.find((container) => container.id === selectedId) ?? containers[0]
  }, [containers, selectedId])

  const handleViewLogs = async () => {
    if (!selectedContainer || !onViewLogs) return
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsError(null)
    try {
      const output = await onViewLogs(selectedContainer.id)
      setLogsText(output ?? '')
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : 'Failed to load logs.')
      setLogsText('')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleCopyLogs = async () => {
    if (!logsText) return
    try {
      await navigator.clipboard.writeText(logsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const logsDisplay = logsLoading
    ? 'Loading logs...'
    : logsError
      ? logsError
      : logsText || 'No logs returned.'

  return (
    <>
      <SectionLayout
        list={
          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Containers</p>
            </div>
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  Loading containers...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                  {error}
                </div>
              ) : containers.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  No containers detected.
                </div>
              ) : (
                containers.map((container) => {
                  const isActive = selectedContainer?.id === container.id
                  return (
                    <button
                      key={container.id}
                      onClick={() => setSelectedId(container.id)}
                      aria-pressed={isActive}
                      className={`group relative flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0 ${
                        isActive
                          ? "bg-accent/70 text-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                          : 'hover:bg-accent/60'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[container.state]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{container.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{container.image}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {container.state}
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
            {selectedContainer ? (
              <div className="flex h-full flex-col gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Details</p>
                    <h2 className="mt-3 text-lg font-semibold">{selectedContainer.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedContainer.image}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[selectedContainer.state]}`} />
                    <span className="capitalize">{selectedContainer.state}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ports</p>
                    <p className="text-muted-foreground">
                      {selectedContainer.ports.length ? selectedContainer.ports.join(', ') : 'No ports exposed'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {selectedContainer.state === 'running' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={handleViewLogs}
                        disabled={!onViewLogs}
                      >
                        <Logs className="h-4 w-4" />
                        Logs
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        onClick={() => onStopContainer?.(selectedContainer.id)}
                        disabled={!onStopContainer}
                      >
                        <Square className="h-4 w-4" />
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => onStartContainer?.(selectedContainer.id)}
                      disabled={!onStartContainer}
                    >
                      <Power className="h-4 w-4" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a container to see details.
              </div>
            )}
          </div>
        }
      />
      <Dialog
        open={logsOpen}
        onOpenChange={(open) => {
          setLogsOpen(open)
          if (!open) {
            setLogsError(null)
            setLogsLoading(false)
            setLogsText('')
            setCopied(false)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
            <DialogDescription>Latest output for {selectedContainer?.name ?? 'container'}.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/60">
            <ScrollArea className="h-[50vh]">
              <pre className="p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {logsDisplay}
              </pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopyLogs} disabled={!logsText}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Logs
                </>
              )}
            </Button>
            <Button onClick={() => setLogsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
