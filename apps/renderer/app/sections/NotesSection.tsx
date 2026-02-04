import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Textarea } from '../components/ui/Textarea'
import { Separator } from '../components/ui/Separator'
import { SectionLayout } from '../layout/SectionLayout'
import type { Project, ProjectNotes } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

export function NotesSection({
  projects,
  notes,
  isLoading,
  error,
  onSaveNotes,
}: {
  projects: Project[]
  notes: Record<string, ProjectNotes>
  isLoading?: boolean
  error?: string | null
  onSaveNotes?: (projectId: string, updates: Partial<ProjectNotes>) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [draft, setDraft] = useState({ setupSteps: '', todos: '', reminders: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const selectedNotes = selectedProject ? notes[selectedProject.id] : null

  useEffect(() => {
    setDraft({
      setupSteps: selectedNotes?.setupSteps ?? '',
      todos: selectedNotes?.todos ?? '',
      reminders: selectedNotes?.reminders ?? '',
    })
    setIsEditing(false)
    setSaveError(null)
  }, [selectedNotes?.projectId, selectedNotes?.setupSteps, selectedNotes?.todos, selectedNotes?.reminders])

  const handleSave = async () => {
    if (!selectedProject || !onSaveNotes) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSaveNotes(selectedProject.id, draft)
      setIsEditing(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save notes.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                Loading notes...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No projects available.
              </div>
            ) : (
              projects.map((project) => {
                const isActive = selectedProject?.id === project.id
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    aria-pressed={isActive}
                    className={`group relative flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0 ${
                      isActive
                        ? "bg-accent/70 text-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                        : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                    </div>
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
            <div className="flex h-full flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project Notes</p>
                <h2 className="mt-3 text-lg font-semibold">{selectedProject.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedProject.path}</p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Setup Steps / Runbook
                  </Label>
                  <Textarea
                    value={draft.setupSteps}
                    onChange={(event) => {
                      if (!isEditing) setIsEditing(true)
                      setDraft((prev) => ({ ...prev, setupSteps: event.target.value }))
                    }}
                    onFocus={() => setIsEditing(true)}
                    placeholder="Setup steps, commands, or runbook notes."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Todos</Label>
                  <Textarea
                    value={draft.todos}
                    onChange={(event) => {
                      if (!isEditing) setIsEditing(true)
                      setDraft((prev) => ({ ...prev, todos: event.target.value }))
                    }}
                    onFocus={() => setIsEditing(true)}
                    placeholder="Todos, one per line."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reminders</Label>
                  <Textarea
                    value={draft.reminders}
                    onChange={(event) => {
                      if (!isEditing) setIsEditing(true)
                      setDraft((prev) => ({ ...prev, reminders: event.target.value }))
                    }}
                    onFocus={() => setIsEditing(true)}
                    placeholder="Reminders."
                  />
                </div>
              </div>
              <div className="mt-auto">
                {saveError ? (
                  <p className="mb-2 text-xs text-destructive">{saveError}</p>
                ) : null}
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Notes
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a project to see notes.
            </div>
          )}
        </div>
      }
    />
  )
}
