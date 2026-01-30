import { useEffect, useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { SectionLayout } from '../layout/SectionLayout'
import type { Command, Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

export function CommandsSection({
  commands,
  projects,
  isLoading,
  error,
  onRunCommand,
}: {
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onRunCommand?: (commandId: string, projectId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(commands[0]?.id ?? null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'started'>('idle')

  useEffect(() => {
    if (!commands.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !commands.some((command) => command.id === selectedId)) {
      setSelectedId(commands[0].id)
    }
  }, [commands, selectedId])

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null)
      return
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  const selectedCommand = useMemo(() => {
    if (!commands.length) return null
    return commands.find((command) => command.id === selectedId) ?? commands[0]
  }, [commands, selectedId])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  }, [projects, selectedProjectId])

  const handleRun = async () => {
    if (!selectedCommand || !selectedProject || !onRunCommand || runStatus === 'running') {
      if (!selectedProject) {
        setRunError('Select a project to run this command.')
      }
      return
    }
    setRunError(null)
    setRunStatus('running')
    try {
      await onRunCommand(selectedCommand.id, selectedProject.id)
      setRunStatus('started')
      setTimeout(() => setRunStatus('idle'), 1500)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to run command.')
      setRunStatus('idle')
    }
  }

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Commands</p>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                Loading commands...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                {error}
              </div>
            ) : commands.length === 0 ? (
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
                <div className="space-y-2">
                  <Label htmlFor="run-project">Project</Label>
                  {projects.length ? (
                    <select
                      id="run-project"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedProject?.id ?? ''}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted-foreground">Add a project to run this command.</p>
                  )}
                  {selectedProject ? (
                    <p className="text-xs text-muted-foreground">{selectedProject.path}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-auto">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleRun}
                  disabled={!selectedCommand || !selectedProject || runStatus === 'running'}
                >
                  <Play className="h-4 w-4" />
                  {runStatus === 'running' ? 'Starting...' : 'Run Command'}
                </Button>
                {runStatus === 'started' ? (
                  <p className="mt-2 text-xs text-muted-foreground">Run started. Check History for output.</p>
                ) : null}
                {runError ? (
                  <p className="mt-2 text-xs text-destructive">{runError}</p>
                ) : null}
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
