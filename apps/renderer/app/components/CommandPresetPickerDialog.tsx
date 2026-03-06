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
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 bg-muted/20 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
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
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted/30 text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No preset-ready projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a Node, Python, Rust, or Go project to unlock tailored command suggestions.
            </p>
          </div>
        ) : (
          <div className="grid min-h-[480px] gap-0 md:grid-cols-[260px,1fr]">
            <div className="border-b border-border/50 bg-muted/10 md:border-b-0 md:border-r">
              <div className="border-b border-border/40 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Detected Projects
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Presets update automatically from each project&apos;s detected stack.
                </p>
              </div>

              <ScrollArea className="h-[420px]">
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
                          'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary/30 bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/50 bg-background/60 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-background text-base">
                            <span aria-hidden>{project.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{project.name}</p>
                              <Badge variant="outline" className="border-border/50 bg-background/70 text-[10px] font-medium">
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

            <div className="flex min-h-[480px] flex-col">
              <div className="border-b border-border/50 px-6 py-5">
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
                      <h3 className="text-lg font-semibold">{selectedProject.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Add reusable commands bound directly to this project.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <ScrollArea className="flex-1">
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
                        className="rounded-3xl border border-border/50 bg-card/80 p-5 shadow-sm transition-colors hover:border-border hover:bg-card"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-2 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold">{preset.name}</h4>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {preset.description ?? 'Reusable starter command for this project type.'}
                              </p>
                            </div>
                          </div>

                          {isExisting ? (
                            <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-600">
                              Added
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-4 rounded-2xl border border-border/50 bg-[#0d0d0d] px-4 py-3 font-mono text-xs text-blue-300/90 shadow-inner">
                          <code className="break-all">{preset.command}</code>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(preset.tags ?? []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="rounded-full bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <Button
                            size="sm"
                            className="rounded-full px-4"
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

        <DialogFooter className="border-t border-border/50 bg-muted/10 px-6 py-4">
          {createError ? <p className="mr-auto text-xs text-destructive">{createError}</p> : <div className="mr-auto" />}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
