import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Hammer,
  Package,
  Play,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import type { Command, CommandPresetIcon, CreateCommandInput, Project } from '../types'
import { getCommandPresetsForProjectType, getProjectTypeLabel } from '../lib/commandPresets'
import { cn } from '../../lib/utils'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog'
import { ScrollArea } from './ui/ScrollArea'

const presetIconMap: Record<CommandPresetIcon, LucideIcon> = {
  package: Package,
  play: Play,
  hammer: Hammer,
  'check-circle': CheckCircle2,
  'alert-circle': AlertCircle,
  wrench: Wrench,
}

type CommandPresetPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  commands: Command[]
  preferredProjectId?: string | null
  onCreateCommand: (command: CreateCommandInput) => Promise<Command>
}

export function CommandPresetPickerDialog({
  open,
  onOpenChange,
  projects,
  commands,
  preferredProjectId,
  onCreateCommand,
}: CommandPresetPickerDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creatingPresetId, setCreatingPresetId] = useState<string | null>(null)

  const eligibleProjects = useMemo(
    () => projects.filter((project) => getCommandPresetsForProjectType(project.type).length > 0),
    [projects]
  )

  useEffect(() => {
    if (!open) {
      setCreateError(null)
      setCreatingPresetId(null)
      return
    }

    const projectIds = new Set(eligibleProjects.map((project) => project.id))
    const preferredEligibleProject =
      preferredProjectId && projectIds.has(preferredProjectId)
        ? preferredProjectId
        : eligibleProjects[0]?.id ?? null

    setSelectedProjectId((current) => (current && projectIds.has(current) ? current : preferredEligibleProject))
  }, [eligibleProjects, open, preferredProjectId])

  const selectedProject = useMemo(
    () => eligibleProjects.find((project) => project.id === selectedProjectId) ?? eligibleProjects[0] ?? null,
    [eligibleProjects, selectedProjectId]
  )

  const selectedPresets = useMemo(
    () => (selectedProject ? getCommandPresetsForProjectType(selectedProject.type) : []),
    [selectedProject]
  )

  const existingPresetKeys = useMemo(
    () =>
      new Set(
        commands.map((command) => {
          const projectKey = command.projectId ?? '__global__'
          return `${projectKey}::${command.name.trim().toLowerCase()}::${command.command.trim().toLowerCase()}`
        })
      ),
    [commands]
  )

  const getPresetKey = (projectId: string, name: string, command: string) =>
    `${projectId}::${name.trim().toLowerCase()}::${command.trim().toLowerCase()}`

  const handleCreatePreset = async (presetId: string) => {
    if (!selectedProject) {
      return
    }

    const preset = selectedPresets.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }

    setCreateError(null)
    setCreatingPresetId(preset.id)

    try {
      await onCreateCommand({
        name: preset.name,
        command: preset.command,
        description: preset.description,
        tags: preset.tags,
        projectId: selectedProject.id,
      })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create preset command.')
    } finally {
      setCreatingPresetId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0 flex flex-col h-[85vh] max-h-[800px]">
        <DialogHeader className="border-b border-border/50 bg-muted/20 px-6 py-5 shrink-0">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Add Preset</DialogTitle>
              <DialogDescription>
                Pick a detected project to load command presets that match its project type.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {eligibleProjects.length === 0 ? (
          <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted/30 text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No preset-ready projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a Node, Python, Rust, or Go project to unlock tailored command suggestions.
            </p>
          </div>
        ) : (
          <div className="grid flex-1 gap-0 md:grid-cols-[280px,1fr] min-h-0 overflow-hidden">
            <div className="flex flex-col border-b border-border/50 bg-muted/10 md:border-b-0 md:border-r min-h-0">
              <div className="border-b border-border/40 px-5 py-4 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Detected Projects
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Presets update automatically from each project&apos;s detected stack.
                </p>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 p-3">
                  {eligibleProjects.map((project) => {
                    const isSelected = project.id === selectedProject?.id
                    const presetCount = getCommandPresetsForProjectType(project.type).length

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setCreateError(null)
                          setSelectedProjectId(project.id)
                        }}
                        className={cn(
                          'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary/15 bg-primary/10 text-foreground'
                            : 'border-transparent bg-background/60 text-muted-foreground hover:border-border/40 hover:bg-muted/30 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background text-base">
                            <span aria-hidden>{project.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{project.name}</p>
                              <Badge variant="outline" className="border-border/50 bg-background/70 text-[10px] font-medium shrink-0">
                                {presetCount}
                              </Badge>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {getProjectTypeLabel(project.type)} presets
                            </p>
                            <p className="mt-2 truncate text-[10px] text-muted-foreground/80">{project.path}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col min-w-0 min-h-0">
              <div className="border-b border-border/50 px-6 py-5 shrink-0 bg-background/50">
                {selectedProject ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]">
                        {getProjectTypeLabel(selectedProject.type)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/50 px-3 py-1 text-[10px] font-medium">
                        {selectedPresets.length} presets
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold truncate">{selectedProject.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Add reusable commands bound directly to this project.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <ScrollArea className="flex-1 min-h-0 bg-card/30">
                <div className="grid gap-4 p-6 xl:grid-cols-2">
                  {selectedPresets.map((preset) => {
                    const Icon = presetIconMap[preset.icon]
                    const isCreating = creatingPresetId === preset.id
                    const isExisting =
                      selectedProject !== null &&
                      existingPresetKeys.has(getPresetKey(selectedProject.id, preset.name, preset.command))

                    return (
                      <article
                        key={preset.id}
                        className="flex flex-col rounded-lg border border-border/40 bg-card p-5 transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <h4 className="text-[15px] font-semibold truncate text-foreground/90">{preset.name}</h4>
                              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                {preset.description ?? 'Reusable starter command for this project type.'}
                              </p>
                            </div>
                          </div>

                          {isExisting ? (
                            <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 shrink-0">
                              Added
                            </Badge>
                          ) : null}
                        </div>

                        <div className="relative mt-5 overflow-hidden rounded-lg border border-code-border bg-code px-4 py-3.5 font-mono text-ui-code text-code-foreground shadow-inner group">
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/40 rounded-l-2xl"></div>
                          <code className="break-all">{preset.command}</code>
                        </div>

                        <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5 overflow-hidden">
                            {(preset.tags ?? []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground truncate max-w-[80px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <Button
                            size="sm"
                            className="rounded-full px-5 h-8 text-xs font-semibold shrink-0 shadow-sm"
                            onClick={() => void handleCreatePreset(preset.id)}
                            disabled={isExisting || isCreating}
                          >
                            {isCreating ? 'Adding...' : 'Add Command'}
                          </Button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 shrink-0">
          {createError ? <p className="mr-auto text-xs text-destructive flex items-center gap-2"><AlertCircle className="h-3 w-3" />{createError}</p> : <div className="mr-auto" />}
          <Button variant="secondary" className="rounded-full px-6" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
