import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Terminal } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SectionLayout } from '../layout/SectionLayout'
import type { Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'

export function ProjectsSection({
  projects,
  isLoading,
  error,
}: {
  projects: Project[]
  isLoading?: boolean
  error?: string | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !projects.some((project) => project.id === selectedId)) {
      setSelectedId(projects[0].id)
    }
  }, [projects, selectedId])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedId) ?? projects[0]
  }, [projects, selectedId])

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Projects</p>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                Loading projects...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No projects added yet.
              </div>
            ) : (
              projects.map((project) => {
                const isActive = selectedProject?.id === project.id
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                      {project.type}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
        </div>
      }
      detail={
        <div className={`${panelClass} p-5`}>
          {selectedProject ? (
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Details</p>
                  <h2 className="mt-3 text-lg font-semibold">{selectedProject.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedProject.path}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</span>
                  <span className="text-foreground">{selectedProject.type}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="gap-1.5" disabled>
                  <ExternalLink className="h-4 w-4" />
                  Open Folder
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled>
                  <Terminal className="h-4 w-4" />
                  Run Command
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a project to see details.
            </div>
          )}
        </div>
      }
    />
  )
}
