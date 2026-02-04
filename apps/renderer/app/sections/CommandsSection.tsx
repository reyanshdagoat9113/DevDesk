import { useEffect, useMemo, useState } from 'react'
import { Pencil, Play, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Badge } from '../components/ui/Badge'
import { Separator } from '../components/ui/Separator'
import { Textarea } from '../components/ui/Textarea'
import { SectionLayout } from '../layout/SectionLayout'
import type { Command, Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

export function CommandsSection({
  commands,
  projects,
  isLoading,
  error,
  onRunCommand,
  onUpdateCommand,
  onRemoveCommand,
}: {
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onRunCommand?: (commandId: string, projectId: string) => Promise<void>
  onUpdateCommand?: (commandId: string, updates: { name: string; command: string; description?: string; tags?: string[] }) => Promise<void>
  onRemoveCommand?: (commandId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(commands[0]?.id ?? null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'started'>('idle')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!commands.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !commands.some((command) => command.id === selectedId)) {
      setSelectedId(commands[0].id)
    }
  }, [commands, selectedId])

  const selectedCommand = useMemo(() => {
    if (!commands.length) return null
    return commands.find((command) => command.id === selectedId) ?? commands[0]
  }, [commands, selectedId])

  useEffect(() => {
    if (!selectedCommand) {
      setEditName('')
      setEditCommand('')
      setEditDescription('')
      setEditTags('')
      return
    }
    setEditName(selectedCommand.name)
    setEditCommand(selectedCommand.command)
    setEditDescription(selectedCommand.description ?? '')
    setEditTags(selectedCommand.tags?.join(', ') ?? '')
  }, [selectedCommand?.id, selectedCommand?.name, selectedCommand?.command, selectedCommand?.description, selectedCommand?.tags])

  // Get the project associated with this command
  const commandProject = useMemo(() => {
    if (!selectedCommand?.projectId || !projects.length) return null
    return projects.find((project) => project.id === selectedCommand.projectId) ?? null
  }, [selectedCommand, projects])

  // For commands without a project, show all projects
  // For commands with a project, only show that project
  const availableProjects = useMemo(() => {
    if (commandProject) return [commandProject]
    return projects
  }, [commandProject, projects])

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    commandProject?.id ?? projects[0]?.id ?? null
  )

  // Update selected project when command project changes
  useEffect(() => {
    if (commandProject) {
      setSelectedProjectId(commandProject.id)
    } else if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id)
    }
  }, [commandProject, projects])

  const selectedProject = useMemo(() => {
    if (!availableProjects.length) return null
    return availableProjects.find((project) => project.id === selectedProjectId) ?? availableProjects[0]
  }, [availableProjects, selectedProjectId])

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

  const handleSaveEdit = async () => {
    if (!selectedCommand || !onUpdateCommand || isSavingEdit) return
    const trimmedName = editName.trim()
    const trimmedCommand = editCommand.trim()
    if (!trimmedName || !trimmedCommand) {
      setEditError('Command name and command are required.')
      return
    }
    setEditError(null)
    setIsSavingEdit(true)
    try {
      const trimmedTags = editTags.trim()
      const tags = trimmedTags
        ? trimmedTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []
      await onUpdateCommand(selectedCommand.id, {
        name: trimmedName,
        command: trimmedCommand,
        description: editDescription.trim(),
        tags,
      })
      setEditDialogOpen(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update command.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRemoveCommand = async () => {
    if (!selectedCommand || !onRemoveCommand || isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await onRemoveCommand(selectedCommand.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to remove command.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
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
                const cmdProject = command.projectId
                  ? projects.find((p) => p.id === command.projectId)
                  : null
                return (
                  <button
                    key={command.id}
                    onClick={() => setSelectedId(command.id)}
                    aria-pressed={isActive}
                    className={`group relative flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0 ${
                      isActive
                        ? "bg-accent/70 text-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                        : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{command.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {command.description ?? 'No description'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {cmdProject ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {cmdProject.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Global
                          </Badge>
                        )}
                        {command.workingDirectory && (
                          <span className="text-[10px] text-muted-foreground">
                            {command.workingDirectory}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                      {command.tags?.length ?? 0}
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
                <pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
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
                {commandProject && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Project:</span>
                    <Badge variant="secondary">{commandProject.name}</Badge>
                  </div>
                )}
                {selectedCommand.workingDirectory && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Working directory:</span>
                    <code className="text-xs bg-muted/40 px-2 py-0.5 rounded">{selectedCommand.workingDirectory}</code>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="run-project">Project</Label>
                  {availableProjects.length ? (
                    <select
                      id="run-project"
                      className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedProject?.id ?? ''}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                      disabled={!!commandProject}
                    >
                      {availableProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted-foreground">Add a project to run this command.</p>
                  )}
                  {selectedProject && (
                    <p className="text-xs text-muted-foreground">
                      {selectedProject.path}
                      {selectedCommand.workingDirectory ? `/${selectedCommand.workingDirectory}` : ''}
                    </p>
                  )}
                  {commandProject && (
                    <p className="text-xs text-muted-foreground">
                      This command is bound to this project.
                    </p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="mt-auto space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleRun}
                    disabled={!selectedCommand || !selectedProject || runStatus === 'running'}
                  >
                    <Play className="h-4 w-4" />
                    {runStatus === 'running' ? 'Starting...' : 'Run Command'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={!onUpdateCommand}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveCommand}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
                {runStatus === 'started' ? (
                  <p className="text-xs text-muted-foreground">Run started. Check History for output.</p>
                ) : null}
                {runError ? <p className="text-xs text-destructive">{runError}</p> : null}
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
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (open && selectedCommand) {
            setEditName(selectedCommand.name)
            setEditCommand(selectedCommand.command)
            setEditDescription(selectedCommand.description ?? '')
            setEditTags(selectedCommand.tags?.join(', ') ?? '')
          }
          if (!open) {
            setEditError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit command</DialogTitle>
            <DialogDescription>Update the name, command, and metadata.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-command-name">Name</Label>
              <Input
                id="edit-command-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Run tests"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-command-value">Command</Label>
              <Textarea
                id="edit-command-value"
                value={editCommand}
                onChange={(event) => setEditCommand(event.target.value)}
                placeholder="npm test -- --watch"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-command-description">Description (optional)</Label>
              <Input
                id="edit-command-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Run tests in watch mode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-command-tags">Tags (comma separated)</Label>
              <Input
                id="edit-command-tags"
                value={editTags}
                onChange={(event) => setEditTags(event.target.value)}
                placeholder="test, watch"
              />
            </div>
            {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !onUpdateCommand}>
              {isSavingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove command?</DialogTitle>
            <DialogDescription>This deletes the saved command. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveCommand} disabled={isDeleting || !onRemoveCommand}>
              {isDeleting ? 'Removing...' : 'Remove command'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
