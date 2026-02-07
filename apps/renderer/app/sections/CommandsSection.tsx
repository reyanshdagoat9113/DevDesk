import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Search, Terminal, Hash, PlayCircle, Folder } from 'lucide-react'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Badge } from '../components/ui/Badge'
import { Textarea } from '../components/ui/Textarea'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type { Command, Project } from '../types'

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const normalizedQueryTokens = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    return trimmed.split(/\s+/).filter(Boolean)
  }, [query])

  const tagOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const cmd of commands) {
      for (const rawTag of cmd.tags ?? []) {
        const trimmed = rawTag.trim()
        if (!trimmed) continue
        const key = trimmed.toLowerCase()
        const current = counts.get(key)
        if (current) {
          current.count += 1
        } else {
          counts.set(key, { label: trimmed, count: 1 })
        }
      }
    }

    const list = Array.from(counts.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
    }))

    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.label.localeCompare(b.label)
    })

    return list
  }, [commands])

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      if (selectedTag) {
        const matchesTag = (cmd.tags ?? [])
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .includes(selectedTag)
        if (!matchesTag) return false
      }

      if (!normalizedQueryTokens.length) {
        return true
      }

      const haystack = [cmd.name, cmd.description ?? '', cmd.command, ...(cmd.tags ?? [])]
        .join(' ')
        .toLowerCase()

      return normalizedQueryTokens.every((token) => haystack.includes(token))
    })
  }, [commands, normalizedQueryTokens, selectedTag])

  useEffect(() => {
    if (!filteredCommands.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredCommands.some((command) => command.id === selectedId)) {
      setSelectedId(filteredCommands[0].id)
    }
  }, [filteredCommands, selectedId])

  const selectedCommand = useMemo(() => {
    if (!filteredCommands.length) return null
    return filteredCommands.find((command) => command.id === selectedId) ?? filteredCommands[0]
  }, [filteredCommands, selectedId])

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
  }, [selectedCommand])

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
  }, [commandProject, projects, selectedProjectId])

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
        <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
          <div className="border-b border-border/40 bg-muted/20 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commands</p>
                {filteredCommands.length > 0 && (
                  <Badge variant="outline" className="text-[10px] font-medium">{filteredCommands.length}</Badge>
                )}
              </div>
              {(selectedTag || normalizedQueryTokens.length > 0) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setSelectedTag(null)
                    setQuery('')
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commands..."
                className="h-8 pl-8 text-xs bg-background/50"
              />
            </div>

            {tagOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tagOptions.map((tag) => {
                  const isActive = selectedTag === tag.key
                  return (
                    <button
                      key={tag.key}
                      onClick={() => setSelectedTag((current) => (current === tag.key ? null : tag.key))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                        isActive 
                          ? "border-primary/50 bg-primary/10 text-primary" 
                          : "border-border/50 bg-background hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <Hash className="h-2.5 w-2.5 opacity-50" />
                      <span className="font-medium">{tag.label}</span>
                      <span className="opacity-50 text-[9px]">{tag.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading commands...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : commands.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No commands saved yet.
              </div>
            ) : filteredCommands.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No matches found.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((command) => {
                  const isActive = selectedCommand?.id === command.id
                  
                  return (
                    <button
                      key={command.id}
                      onClick={() => setSelectedId(command.id)}
                      className={cn(
                        "group flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-all",
                        isActive 
                          ? "bg-primary/10 text-foreground shadow-sm" 
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="truncate text-sm font-medium">{command.name}</span>
                        {command.tags?.length ? (
                          <Badge variant="outline" className={cn(
                            "ml-2 h-4 px-1 text-[9px] border-border/40",
                            isActive ? "bg-background/50" : "bg-muted/30"
                          )}>
                            {command.tags.length}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] opacity-70">
                        <span className="truncate flex-1 font-mono">{command.command}</span>
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
        selectedCommand ? (
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{selectedCommand.name}</CardTitle>
                    {commandProject ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                        <Folder className="h-3 w-3" />
                        {commandProject.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        Global
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {selectedCommand.description || "No description provided."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={!onUpdateCommand}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveCommand}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-6 space-y-6">
              {/* Command Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Command</Label>
                  {selectedCommand.workingDirectory && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                      <Folder className="h-3 w-3" /> {selectedCommand.workingDirectory}
                    </span>
                  )}
                </div>
                <div className="relative group rounded-md border border-border/50 bg-muted/30 p-4 font-mono text-sm">
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* Could add copy button here */}
                  </div>
                  <code className="break-all text-foreground/90">{selectedCommand.command}</code>
                </div>
              </div>

              {selectedCommand.tags && selectedCommand.tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCommand.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-xs font-normal">
                        <Hash className="mr-1 h-3 w-3 opacity-50" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            <div className="border-t border-border/40 bg-muted/10 p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="run-project" className="text-xs font-medium">Target Project</Label>
                  <div className="flex gap-2">
                    <select
                      id="run-project"
                      className="flex h-9 w-full flex-1 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      value={selectedProject?.id ?? ''}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                      disabled={!!commandProject || availableProjects.length === 0}
                    >
                      {availableProjects.length === 0 ? (
                         <option value="" disabled>No projects available</option>
                      ) : (
                        availableProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))
                      )}
                    </select>
                    <Button
                      className="gap-2 shadow-sm"
                      onClick={handleRun}
                      disabled={!selectedCommand || !selectedProject || runStatus === 'running'}
                    >
                      {runStatus === 'running' ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-r-transparent" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      {runStatus === 'running' ? 'Running...' : 'Run Command'}
                    </Button>
                  </div>
                </div>
                
                {runError && (
                  <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {runError}
                  </div>
                )}
                
                {runStatus === 'started' && (
                  <div className="rounded-md bg-green-500/10 p-2 text-xs text-green-500 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Command started successfully
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/40 bg-card/50 p-6 text-center shadow-sm">
            <div className="space-y-2">
              <Terminal className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium">No command selected</h3>
              <p className="text-sm text-muted-foreground">Select a command to view details or run it.</p>
            </div>
          </Card>
        )
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
                className="font-mono text-xs"
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
