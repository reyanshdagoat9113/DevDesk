import { useEffect, useMemo, useState, useCallback } from 'react'
import { Pencil, Trash2, Search, Terminal, Hash, PlayCircle, Folder, Globe, Loader2, Variable, Star, Sparkles, PlusCircle } from 'lucide-react'
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
import { VariablePromptModal } from '../components/VariablePromptModal'
import { CommandPresetPickerDialog } from '../components/CommandPresetPickerDialog'
import { getCommandPresetsForProjectType } from '../lib/commandPresets'
import { cn } from '../../lib/utils'
import type { Command, CommandVariable, CreateCommandInput, Project } from '../types'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

const UNTAGGED_FILTER_KEY = '__untagged__'

function getNormalizedTags(command: Command): string[] {
  return (command.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
}

export function CommandsSection({
  commands,
  projects,
  isLoading,
  error,
  onRunCommand,
  onUpdateCommand,
  onToggleCommandPin,
  onRemoveCommand,
  onCreatePresetCommand,
  onAddToChain,
}: {
  commands: Command[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onRunCommand?: (commandId: string, projectId: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }>
  onUpdateCommand?: (commandId: string, updates: { name: string; command: string; description?: string; tags?: string[] }) => Promise<void>
  onToggleCommandPin?: (commandId: string) => Promise<Command>
  onRemoveCommand?: (commandId: string) => Promise<void>
  onCreatePresetCommand?: (command: CreateCommandInput) => Promise<Command>
  onAddToChain?: (command: Command) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(commands[0]?.id ?? null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'started'>('idle')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null)
  const [isUpdatingTags, setIsUpdatingTags] = useState(false)

  // Variable prompt state
  const [variablePromptOpen, setVariablePromptOpen] = useState(false)
  const [pendingVariables, setPendingVariables] = useState<CommandVariable[]>([])
  const [commandPreview, setCommandPreview] = useState<string>('')
  const [pendingRun, setPendingRun] = useState<{ commandId: string; projectId: string } | null>(null)

  // Variable detection state
  const [detectedVariables, setDetectedVariables] = useState<CommandVariable[]>([])

  const normalizedQueryTokens = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    return trimmed.split(/\s+/).filter(Boolean)
  }, [query])

  const tagOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const cmd of commands) {
      for (const rawTag of getNormalizedTags(cmd)) {
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

  const untaggedCount = useMemo(
    () => commands.filter((command) => getNormalizedTags(command).length === 0).length,
    [commands]
  )

  const maxTagCount = useMemo(
    () => Math.max(untaggedCount, ...tagOptions.map((tag) => tag.count), 1),
    [tagOptions, untaggedCount]
  )

  const projectsWithPresets = useMemo(
    () => projects.filter((project) => getCommandPresetsForProjectType(project.type).length > 0),
    [projects]
  )

  const filteredCommands = useMemo(() => {
    const filtered = commands.filter((cmd) => {
      const normalizedTags = getNormalizedTags(cmd).map((tag) => tag.toLowerCase())
      const selectedNamedTags = selectedTags.filter((tag) => tag !== UNTAGGED_FILTER_KEY)
      const includesUntagged = selectedTags.includes(UNTAGGED_FILTER_KEY)

      if (selectedTags.length > 0) {
        const matchesNamedTags = selectedNamedTags.some((tag) => normalizedTags.includes(tag))
        const matchesUntagged = includesUntagged && normalizedTags.length === 0

        if (!matchesNamedTags && !matchesUntagged) {
          return false
        }
      }

      if (!normalizedQueryTokens.length) {
        return true
      }

      const haystack = [cmd.name, cmd.description ?? '', cmd.command, ...(cmd.tags ?? [])]
        .join(' ')
        .toLowerCase()

      return normalizedQueryTokens.every((token) => haystack.includes(token))
    })

    // Sort: pinned first, then by name
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      if (a.isPinned && b.isPinned) {
        const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
        const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
        return bTime - aTime
      }
      return a.name.localeCompare(b.name)
    })
  }, [commands, normalizedQueryTokens, selectedTags])

  const [pinnedCommands, unpinnedCommands] = useMemo(() => {
    const pinned = filteredCommands.filter((command) => command.isPinned)
    const unpinned = filteredCommands.filter((command) => !command.isPinned)
    return [pinned, unpinned]
  }, [filteredCommands])

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
      setDetectedVariables([])
      setTagUpdateError(null)
      return
    }
    setEditName(selectedCommand.name)
    setEditCommand(selectedCommand.command)
    setEditDescription(selectedCommand.description ?? '')
    setEditTags(selectedCommand.tags?.join(', ') ?? '')
    let cancelled = false

    const detect = async () => {
      try {
        const vars = await window.electronAPI.detectCommandVariables(selectedCommand.command)
        if (!cancelled) {
          setDetectedVariables(vars)
        }
      } catch {
        if (!cancelled) {
          setDetectedVariables([])
        }
      }
    }
    void detect()

    return () => {
      cancelled = true
    }
  }, [selectedCommand])

  const selectedCommandTagKeys = useMemo(
    () => new Set((selectedCommand ? getNormalizedTags(selectedCommand) : []).map((tag) => tag.toLowerCase())),
    [selectedCommand]
  )

  const toggleTagFilter = useCallback((tagKey: string) => {
    setSelectedTags((current) =>
      current.includes(tagKey) ? current.filter((tag) => tag !== tagKey) : [...current, tagKey]
    )
  }, [])

  const handleToggleCommandTag = useCallback(async (tagLabel: string) => {
    if (!selectedCommand || !onUpdateCommand || isUpdatingTags) {
      return
    }

    const normalizedTag = tagLabel.trim()
    if (!normalizedTag) {
      return
    }

    const tagKey = normalizedTag.toLowerCase()
    const currentTags = getNormalizedTags(selectedCommand)
    const hasTag = currentTags.some((tag) => tag.toLowerCase() === tagKey)
    const nextTags = hasTag
      ? currentTags.filter((tag) => tag.toLowerCase() !== tagKey)
      : [...currentTags, normalizedTag]

    setTagUpdateError(null)
    setIsUpdatingTags(true)
    try {
      await onUpdateCommand(selectedCommand.id, {
        name: selectedCommand.name,
        command: selectedCommand.command,
        description: selectedCommand.description,
        tags: nextTags,
      })
    } catch (error) {
      setTagUpdateError(error instanceof Error ? error.message : 'Failed to update tags.')
    } finally {
      setIsUpdatingTags(false)
    }
  }, [isUpdatingTags, onUpdateCommand, selectedCommand])

  const getCloudClasses = useCallback((count: number, isActive: boolean) => {
    const intensity = count / maxTagCount
    return cn(
      'rounded-full border transition-all duration-150',
      intensity > 0.75 && 'px-3.5 py-1.5 text-xs font-semibold',
      intensity <= 0.75 && intensity > 0.4 && 'px-3 py-1 text-[11px] font-semibold',
      intensity <= 0.4 && 'px-2.5 py-1 text-[10px] font-medium',
      isActive
        ? 'border-primary/50 bg-primary/12 text-primary shadow-sm'
        : 'border-border/50 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
    )
  }, [maxTagCount])

  // Detect variables as user types in edit mode
  useEffect(() => {
    let cancelled = false

    const detect = async () => {
      if (!editCommand.trim()) {
        if (!cancelled) {
          setDetectedVariables([])
        }
        return
      }
      try {
        const vars = await window.electronAPI.detectCommandVariables(editCommand)
        if (!cancelled) {
          setDetectedVariables(vars)
        }
      } catch {
        if (!cancelled) {
          setDetectedVariables([])
        }
      }
    }
    void detect()

    return () => {
      cancelled = true
    }
  }, [editCommand])

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
      // Try to run - may return needs-input status
      const result = await onRunCommand(selectedCommand.id, selectedProject.id)

      if (result.status === 'needs-input') {
        // Show variable prompt
        const needsInput = result as { status: 'needs-input'; inputs: CommandVariable[]; preview: string }
        setPendingVariables(needsInput.inputs)
        setCommandPreview(needsInput.preview)
        setPendingRun({ commandId: selectedCommand.id, projectId: selectedProject.id })
        setVariablePromptOpen(true)
        setRunStatus('idle')
        return
      }

      // Normal execution
      setRunStatus('started')
      setTimeout(() => setRunStatus('idle'), 1500)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to run command.')
      setRunStatus('idle')
    }
  }

  const handleVariableSubmit = useCallback(
    async (values: Record<string, string>) => {
      if (!pendingRun || !onRunCommand) return

      setRunStatus('running')
      try {
        await onRunCommand(pendingRun.commandId, pendingRun.projectId, values)
        setRunStatus('started')
        setTimeout(() => setRunStatus('idle'), 1500)
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'Failed to run command.')
        setRunStatus('idle')
      } finally {
        setPendingRun(null)
        setPendingVariables([])
      }
    },
    [pendingRun, onRunCommand]
  )

  const handleVariableCancel = useCallback(() => {
    setPendingRun(null)
    setPendingVariables([])
    setCommandPreview('')
  }, [])

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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commands</p>
                {filteredCommands.length > 0 && (
                  <Badge variant="outline" className="text-[10px] font-medium">{filteredCommands.length}</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  onClick={() => setPresetDialogOpen(true)}
                  disabled={!onCreatePresetCommand || projectsWithPresets.length === 0}
                  title={projectsWithPresets.length === 0 ? 'Add a Node, Python, Rust, or Go project to unlock presets.' : 'Add preset command'}
                >
                  <Sparkles className="h-3 w-3" />
                  Add Preset
                </Button>
                {(selectedTags.length > 0 || normalizedQueryTokens.length > 0) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-[10px]"
                    onClick={() => {
                      setSelectedTags([])
                      setQuery('')
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
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

            {(tagOptions.length > 0 || untaggedCount > 0) && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">
                    Tag Cloud
                  </p>
                  {selectedTags.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                      {selectedTags.length} active filter{selectedTags.length === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {untaggedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleTagFilter(UNTAGGED_FILTER_KEY)}
                      className={cn(
                        getCloudClasses(untaggedCount, selectedTags.includes(UNTAGGED_FILTER_KEY)),
                        'flex items-center gap-1.5 border-dashed'
                      )}
                    >
                      <span className="font-medium">Untagged</span>
                      <span className="text-[9px] opacity-60">{untaggedCount}</span>
                    </button>
                  ) : null}

                  {tagOptions.map((tag) => {
                    const isActive = selectedTags.includes(tag.key)
                    return (
                      <button
                        key={tag.key}
                        type="button"
                        onClick={() => toggleTagFilter(tag.key)}
                        className={cn(getCloudClasses(tag.count, isActive), 'flex items-center gap-1.5')}
                      >
                        <Hash className="h-2.5 w-2.5 opacity-50" />
                        <span>{tag.label}</span>
                        <span className="text-[9px] opacity-60">{tag.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto px-2 py-2">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                Loading commands...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/10">
                {error}
              </div>
            ) : commands.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                <Terminal className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No commands saved yet.</p>
              </div>
            ) : filteredCommands.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground opacity-50 italic">
                No matches found.
              </div>
            ) : (
              <div className="space-y-1">

                {pinnedCommands.length > 0 && (
                  <>
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-600/80">Pinned</p>
                    </div>
                    {pinnedCommands.map((command) => {
                      const isActive = selectedCommand?.id === command.id

                      return (
                        <button
                          key={command.id}
                          onClick={() => setSelectedId(command.id)}
                          className={cn(
                            "group flex w-full flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition-all",
                            isActive
                              ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20"
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold leading-none">{command.name}</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                              {command.variables && command.variables.length > 0 && (
                                <Badge variant="outline" className={cn(
                                  "h-4 px-1 text-[8px] border-border/40 font-bold text-primary",
                                  isActive ? "bg-background/50" : "bg-muted/30"
                                )}>
                                  <Variable className="h-2.5 w-2.5 mr-0.5" />
                                  {command.variables.length}
                                </Badge>
                              )}
                              {command.tags?.length ? (
                                <Badge variant="outline" className={cn(
                                  "h-4 px-1 text-[8px] border-border/40 font-bold",
                                  isActive ? "bg-background/50" : "bg-muted/30"
                                )}>
                                  {command.tags.length}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono tracking-tighter truncate">
                            <span className="truncate flex-1">{command.command}</span>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}

                {unpinnedCommands.length > 0 && (
                  <>
                    {pinnedCommands.length > 0 && (
                      <div className="px-2 pt-3 pb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">All Commands</p>
                      </div>
                    )}
                    {unpinnedCommands.map((command) => {
                      const isActive = selectedCommand?.id === command.id

                      return (
                        <button
                          key={command.id}
                          onClick={() => setSelectedId(command.id)}
                          className={cn(
                            "group flex w-full flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition-all",
                            isActive
                              ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20"
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold leading-none">{command.name}</span>
                            <div className="flex items-center gap-1">
                              {command.variables && command.variables.length > 0 && (
                                <Badge variant="outline" className={cn(
                                  "h-4 px-1 text-[8px] border-border/40 font-bold text-primary",
                                  isActive ? "bg-background/50" : "bg-muted/30"
                                )}>
                                  <Variable className="h-2.5 w-2.5 mr-0.5" />
                                  {command.variables.length}
                                </Badge>
                              )}
                              {command.tags?.length ? (
                                <Badge variant="outline" className={cn(
                                  "h-4 px-1 text-[8px] border-border/40 font-bold",
                                  isActive ? "bg-background/50" : "bg-muted/30"
                                )}>
                                  {command.tags.length}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono tracking-tighter truncate">
                            <span className="truncate flex-1">{command.command}</span>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      }
      detail={
        selectedCommand ? (
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
            <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-primary/10 text-primary border border-primary/20">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight truncate">{selectedCommand.name}</CardTitle>
                  </div>
                  <CardDescription className="text-[13px] leading-relaxed max-w-2xl">
                    {selectedCommand.description || "No description provided for this automation workflow."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 ml-4">
                  <Button
                    size="icon"
                    variant="ghost"

                    className={cn(
                      "h-8 w-8 transition-colors",
                      selectedCommand.isPinned
                        ? "text-yellow-500 hover:bg-yellow-500/10"
                        : "text-muted-foreground hover:text-yellow-500 hover:bg-muted/50"
                    )}
                    onClick={() => onToggleCommandPin?.(selectedCommand.id)}
                    disabled={!onToggleCommandPin}
                    title={selectedCommand.isPinned ? 'Unpin command' : 'Pin command'}
                  >
                    <Star className={cn("h-4 w-4", selectedCommand.isPinned && "fill-yellow-500")} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={!onUpdateCommand}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveCommand}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-8 pt-6 space-y-10">
              {/* Context Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Source Context</Label>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/5">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-background border border-border/40 text-xs font-bold">
                      {commandProject ? commandProject.name.slice(0, 1).toUpperCase() : <Globe className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{commandProject ? commandProject.name : 'Global Scope'}</p>
                      <p className="text-[10px] text-muted-foreground truncate opacity-70">
                        {commandProject ? 'Bound to project' : 'Available across all projects'}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedCommand.workingDirectory && (
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Relative Path</Label>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/5 overflow-hidden">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-background border border-border/40">
                        <Folder className="h-4 w-4 opacity-50" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate">{selectedCommand.workingDirectory}</p>
                        <p className="text-[10px] text-muted-foreground truncate opacity-70">Custom working directory</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Command Block */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Instruction String</Label>
                  <Badge variant="outline" className="text-[9px] font-mono opacity-50">SH / BASH</Badge>
                </div>
                <div className="relative group rounded-xl border border-border/40 bg-[#0d0d0d] p-5 font-mono text-sm shadow-inner overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
                  <code className="break-all text-blue-400/90 leading-relaxed">{selectedCommand.command}</code>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Classification Tags</Label>
                  {isUpdatingTags ? (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Updating tags...
                    </div>
                  ) : null}
                </div>

                {getNormalizedTags(selectedCommand).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {getNormalizedTags(selectedCommand).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => void handleToggleCommandTag(tag)}
                        disabled={!onUpdateCommand || isUpdatingTags}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Click to remove this tag"
                      >
                        <Hash className="h-3 w-3 opacity-60" />
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                    This command is currently untagged.
                  </div>
                )}

                {tagOptions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                      Quick Tag Assignment
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((tag) => {
                        const isAssigned = selectedCommandTagKeys.has(tag.key)
                        return (
                          <button
                            key={tag.key}
                            type="button"
                            onClick={() => void handleToggleCommandTag(tag.label)}
                            disabled={!onUpdateCommand || isUpdatingTags}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                              isAssigned
                                ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                                : 'border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
                            )}
                            title={isAssigned ? 'Click to remove tag from this command' : 'Click to assign tag to this command'}
                          >
                            <Hash className="h-3 w-3 opacity-60" />
                            {tag.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Click any tag to add or remove it instantly. Create brand new tags from the edit dialog.
                    </p>
                  </div>
                ) : null}

                {tagUpdateError ? <p className="text-xs text-destructive">{tagUpdateError}</p> : null}
              </div>
              {/* Variables Section */}
              {(selectedCommand.variables && selectedCommand.variables.length > 0) || detectedVariables.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Dynamic Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedCommand.variables ?? detectedVariables).map((variable) => (
                      <Badge 
                        key={variable.name} 
                        variant="secondary" 
                        className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 transition-colors cursor-default"
                      >
                        <Variable className="mr-1.5 h-3 w-3 opacity-60" />
                        {variable.name}
                        {variable.required && <span className="ml-0.5 text-destructive">*</span>}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    These variables will be resolved when the command runs. Required variables marked with <span className="text-destructive">*</span> must be provided.
                  </p>
                </div>
              ) : null}
            </CardContent>

            <div className="border-t border-border/40 bg-muted/5 p-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="run-project" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Target Deployment Project</Label>
                    <div className="flex flex-col gap-3 xl:flex-row">
                      <select
                        id="run-project"
                        className={cn(selectClass, "min-w-0 flex-1 bg-background shadow-sm h-10 px-4")}
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
                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <Button
                          className="h-10 px-6 gap-2.5 shadow-lg shadow-primary/10 font-bold uppercase tracking-wider text-[11px]"
                          onClick={handleRun}
                          disabled={!selectedCommand || !selectedProject || runStatus === 'running'}
                        >
                          {runStatus === 'running' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                          {runStatus === 'running' ? 'Deploying...' : 'Execute Script'}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 px-4 gap-2 text-[11px] font-bold uppercase tracking-wider"
                          onClick={() => selectedCommand && onAddToChain?.(selectedCommand)}
                          disabled={!selectedCommand || !onAddToChain}
                        >
                          <PlusCircle className="h-4 w-4" />
                          Add To Chain
                        </Button>
                      </div>
                    </div>
                </div>
                
                {runError && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2 font-medium">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    {runError}
                  </div>
                )}
                
                {runStatus === 'started' && (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3 text-[11px] text-emerald-500 flex items-center gap-2 font-bold uppercase tracking-wider">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Automation started successfully
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
            <div className="max-w-[240px] space-y-4 opacity-40">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                <Terminal className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-widest">Automation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Select a command template to review execution logic or trigger a new deployment workflow.</p>
              </div>
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

            {/* Detected Variables */}
            {detectedVariables.length > 0 && (
              <div className="space-y-2 rounded-md bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Variable className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium">Detected Variables</Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detectedVariables.map((variable) => (
                    <Badge
                      key={variable.name}
                      variant="secondary"
                      className="text-[10px] font-normal"
                    >
                      {variable.name}
                      {variable.required && (
                        <span className="ml-0.5 text-destructive">*</span>
                      )}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Users will be prompted to enter values when running this command.
                </p>
              </div>
            )}

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

      <VariablePromptModal
        open={variablePromptOpen}
        onOpenChange={setVariablePromptOpen}
        variables={pendingVariables}
        commandPreview={commandPreview}
        onSubmit={handleVariableSubmit}
        onCancel={handleVariableCancel}
      />

      {onCreatePresetCommand ? (
        <CommandPresetPickerDialog
          open={presetDialogOpen}
          onOpenChange={setPresetDialogOpen}
          projects={projects}
          commands={commands}
          preferredProjectId={selectedProject?.id ?? null}
          onCreateCommand={onCreatePresetCommand}
        />
      ) : null}
    </>
  )
}
