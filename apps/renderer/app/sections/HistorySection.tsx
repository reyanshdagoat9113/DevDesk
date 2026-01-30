import { useMemo, useState } from 'react'
import { Square, FileText } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { SectionLayout } from '../layout/SectionLayout'
import type { RunHistoryEntry } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

const statusStyles: Record<RunHistoryEntry['status'], string> = {
  running: 'bg-emerald-500',
  success: 'bg-sky-500',
  failed: 'bg-rose-500',
  stopped: 'bg-amber-400',
}

export function HistorySection({ history }: { history: RunHistoryEntry[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.id ?? null)

  const selectedEntry = useMemo(() => {
    if (!history.length) return null
    return history.find((entry) => entry.id === selectedId) ?? history[0]
  }, [history, selectedId])

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">History</p>
          </div>
          <div className="flex-1 overflow-auto">
            {history.length === 0 ? (
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
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Output</p>
                <pre className="min-h-[160px] rounded-md border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
                  {selectedEntry.output ?? 'No output captured.'}
                </pre>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  View Full Output
                </Button>
                {selectedEntry.status === 'running' ? (
                  <Button size="sm" variant="destructive" className="gap-1.5">
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
  )
}
