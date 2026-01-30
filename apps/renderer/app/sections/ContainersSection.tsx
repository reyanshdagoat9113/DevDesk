import { useEffect, useMemo, useState } from 'react'
import { Square, Power, Logs } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { SectionLayout } from '../layout/SectionLayout'
import type { Container } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

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
  onViewLogs?: (containerId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(containers[0]?.id ?? null)

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

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
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
                    className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
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
            <div className="flex h-full flex-col justify-between gap-6">
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
              <div className="flex flex-wrap gap-2">
                {selectedContainer.state === 'running' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onViewLogs?.(selectedContainer.id)}
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
  )
}
