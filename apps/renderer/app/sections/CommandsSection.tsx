import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SectionLayout } from '../layout/SectionLayout'
import type { Command } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

export function CommandsSection({ commands }: { commands: Command[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(commands[0]?.id ?? null)

  const selectedCommand = useMemo(() => {
    if (!commands.length) return null
    return commands.find((command) => command.id === selectedId) ?? commands[0]
  }, [commands, selectedId])

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Commands</p>
          </div>
          <div className="flex-1 overflow-auto">
            {commands.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No commands saved yet.
              </div>
            ) : (
              commands.map((command) => {
                const isActive = selectedCommand?.id === command.id
                return (
                  <button
                    key={command.id}
                    onClick={() => setSelectedId(command.id)}
                    className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{command.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {command.description ?? 'No description'}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {command.tags?.length ?? 0}
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
          {selectedCommand ? (
            <div className="flex h-full flex-col gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Command</p>
                  <h2 className="mt-3 text-lg font-semibold">{selectedCommand.name}</h2>
                  {selectedCommand.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedCommand.description}</p>
                  ) : null}
                </div>
                <pre className="rounded-md border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
                  <code>{selectedCommand.command}</code>
                </pre>
                {selectedCommand.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCommand.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-auto">
                <Button size="sm" className="gap-2">
                  <Play className="h-4 w-4" />
                  Run Command
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a command to see details.
            </div>
          )}
        </div>
      }
    />
  )
}
