import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  GitBranch,
  Link2,
  Loader2,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
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
import { ScrollArea } from '../components/ui/ScrollArea'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type {
  ChainStep,
  Command,
  CommandChain,
  CommandChainRunState,
  CreateCommandChainInput,
  Project,
} from '../types'

const GLOBAL_PROJECT_VALUE = '__global__'

const statusStyles: Record<CommandChainRunState['status'], string> = {
  running: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  success: 'border-blue-500/20 bg-blue-500/10 text-blue-600',
  failed: 'border-rose-500/20 bg-rose-500/10 text-rose-600',
  stopped: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
}

const stepStatusStyles = {
  pending: 'border-border/50 bg-background/70 text-muted-foreground',
  running: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  success: 'border-blue-500/20 bg-blue-500/10 text-blue-600',
  failed: 'border-rose-500/20 bg-rose-500/10 text-rose-600',
  stopped: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  skipped: 'border-border/50 bg-muted/30 text-muted-foreground',
} as const

type DraftStep = {
  id: string
  commandId: string
  variablesText: string
  delayMs: string
}

type CommandChainsPanelProps = {
  chains: CommandChain[]
  commands: Command[]
  projects: Project[]
  chainRuns: Record<string, CommandChainRunState>
  isLoading?: boolean
  error?: string | null
  seedCommand?: Command | null
  onSeedCommandHandled?: () => void
  onCreateChain: (input: CreateCommandChainInput) => Promise<CommandChain>
  onUpdateChain: (chainId: string, input: CreateCommandChainInput) => Promise<CommandChain>
  onRemoveChain: (chainId: string) => Promise<void>
  onRunChain: (chainId: string, projectId?: string) => Promise<{ runId: string; status: string }>
}

function createDraftStep(commandId = ''): DraftStep {
  return {
    id: crypto.randomUUID(),
    commandId,
    variablesText: '',
    delayMs: '',
  }
}

function serializeVariables(variables?: Record<string, string>): string {
  if (!variables) {
    return ''
  }

  return Object.entries(variables)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

function parseVariablesInput(input: string): Record<string, string> | undefined {
  const entries = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        throw new Error(`Variables must use key=value format. Invalid row: ${line}`)
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      if (!key || !value) {
        throw new Error(`Variables must use key=value format. Invalid row: ${line}`)
      }

      return [key, value] as const
    })

  if (!entries.length) {
    return undefined
  }

  return Object.fromEntries(entries)
}

function chainToDraft(chain: CommandChain): {
  name: string
  description: string
  projectId: string
  stopOnFailure: boolean
  steps: DraftStep[]
} {
  return {
    name: chain.name,
    description: chain.description ?? '',
    projectId: chain.projectId ?? GLOBAL_PROJECT_VALUE,
    stopOnFailure: chain.stopOnFailure,
    steps: chain.steps.map((step) => ({
      id: step.id,
      commandId: step.commandId,
      variablesText: serializeVariables(step.variables),
      delayMs: step.delayMs ? String(step.delayMs) : '',
    })),
  }
}

export function CommandChainsPanel({
  chains,
  commands,
  projects,
  chainRuns,
  isLoading,
  error,
  seedCommand,
  onSeedCommandHandled,
  onCreateChain,
  onUpdateChain,
  onRemoveChain,
  onRunChain,
}: CommandChainsPanelProps) {
  const [selectedChainId, setSelectedChainId] = useState<string | null>(chains[0]?.id ?? null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftProjectId, setDraftProjectId] = useState<string>(GLOBAL_PROJECT_VALUE)
  const [draftStopOnFailure, setDraftStopOnFailure] = useState(true)
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([createDraftStep()])
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [runProjectId, setRunProjectId] = useState<string | null>(projects[0]?.id ?? null)

  useEffect(() => {
    if (!chains.length) {
      setSelectedChainId(null)
      return
    }

    if (!selectedChainId || !chains.some((chain) => chain.id === selectedChainId)) {
      setSelectedChainId(chains[0].id)
    }
  }, [chains, selectedChainId])

  const commandsById = useMemo(
    () => commands.reduce<Record<string, Command>>((acc, command) => ({ ...acc, [command.id]: command }), {}),
    [commands]
  )

  const projectsById = useMemo(
    () => projects.reduce<Record<string, Project>>((acc, project) => ({ ...acc, [project.id]: project }), {}),
    [projects]
  )

  const sortedChains = useMemo(
    () => [...chains].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [chains]
  )

  const selectedChain = useMemo(
    () => sortedChains.find((chain) => chain.id === selectedChainId) ?? sortedChains[0] ?? null,
    [selectedChainId, sortedChains]
  )

  const selectedRun = selectedChain ? chainRuns[selectedChain.id] : undefined

  useEffect(() => {
    if (!selectedChain) {
      setRunProjectId(projects[0]?.id ?? null)
      return
    }

    if (selectedChain.projectId) {
      setRunProjectId(selectedChain.projectId)
      return
    }

    setRunProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) {
        return current
      }
      return projects[0]?.id ?? null
    })
  }, [projects, selectedChain])

  useEffect(() => {
    if (!seedCommand) {
      return
    }

    setDialogMode('create')
    setDraftName(`${seedCommand.name} Chain`)
    setDraftDescription(seedCommand.description ?? '')
    setDraftProjectId(seedCommand.projectId ?? GLOBAL_PROJECT_VALUE)
    setDraftStopOnFailure(true)
    setDraftSteps([createDraftStep(seedCommand.id)])
    setDialogError(null)
    setDialogOpen(true)
    onSeedCommandHandled?.()
  }, [onSeedCommandHandled, seedCommand])

  const commandOptions = useMemo(
    () => [...commands].sort((a, b) => a.name.localeCompare(b.name)),
    [commands]
  )

  const openCreateDialog = () => {
    setDialogMode('create')
    setDraftName('')
    setDraftDescription('')
    setDraftProjectId(GLOBAL_PROJECT_VALUE)
    setDraftStopOnFailure(true)
    setDraftSteps([createDraftStep()])
    setDialogError(null)
    setDialogOpen(true)
  }

  const openEditDialog = () => {
    if (!selectedChain) {
      return
    }

    const draft = chainToDraft(selectedChain)
    setDialogMode('edit')
    setDraftName(draft.name)
    setDraftDescription(draft.description)
    setDraftProjectId(draft.projectId)
    setDraftStopOnFailure(draft.stopOnFailure)
    setDraftSteps(draft.steps)
    setDialogError(null)
    setDialogOpen(true)
  }

  const updateDraftStep = (stepId: string, updates: Partial<DraftStep>) => {
    setDraftSteps((current) => current.map((step) => (step.id === stepId ? { ...step, ...updates } : step)))
  }

  const moveDraftStep = (stepId: string, direction: -1 | 1) => {
    setDraftSteps((current) => {
      const index = current.findIndex((step) => step.id === stepId)
      if (index === -1) {
        return current
      }

      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const buildChainInput = (): CreateCommandChainInput => {
    const name = draftName.trim()
    if (!name) {
      throw new Error('Chain name is required.')
    }

    const steps: ChainStep[] = draftSteps.map((step, index) => {
      const commandId = step.commandId.trim()
      if (!commandId) {
        throw new Error(`Select a command for step ${index + 1}.`)
      }

      const delayValue = step.delayMs.trim()
      const parsedDelay = delayValue ? Number.parseInt(delayValue, 10) : undefined
      if (delayValue && (parsedDelay === undefined || !Number.isFinite(parsedDelay) || parsedDelay < 0)) {
        throw new Error(`Delay for step ${index + 1} must be a positive number.`)
      }

      return {
        id: step.id,
        commandId,
        variables: parseVariablesInput(step.variablesText),
        delayMs: parsedDelay && parsedDelay > 0 ? parsedDelay : undefined,
      }
    })

    return {
      name,
      description: draftDescription.trim() || undefined,
      projectId: draftProjectId === GLOBAL_PROJECT_VALUE ? undefined : draftProjectId,
      steps,
      stopOnFailure: draftStopOnFailure,
      parallel: false,
    }
  }

  const handleSave = async () => {
    setDialogError(null)
    setSavePending(true)
    try {
      const input = buildChainInput()
      const saved =
        dialogMode === 'create'
          ? await onCreateChain(input)
          : await onUpdateChain(selectedChain?.id ?? '', input)
      setSelectedChainId(saved.id)
      setDialogOpen(false)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Failed to save chain.')
    } finally {
      setSavePending(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedChain) {
      return
    }

    setDeleteError(null)
    setDeletePending(true)
    try {
      await onRemoveChain(selectedChain.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete chain.')
    } finally {
      setDeletePending(false)
    }
  }

  const handleRun = async () => {
    if (!selectedChain) {
      return
    }

    setRunError(null)
    try {
      await onRunChain(selectedChain.id, selectedChain.projectId ?? runProjectId ?? undefined)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to run chain.')
    }
  }

  const requiresProjectSelection = useMemo(() => {
    if (!selectedChain) {
      return false
    }

    if (selectedChain.projectId) {
      return false
    }

    return selectedChain.steps.some((step) => !commandsById[step.commandId]?.projectId)
  }, [commandsById, selectedChain])

  return (
    <>
      <SectionLayout
        list={
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chains</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Sequence commands into repeatable workflows.</p>
                </div>
                <Button size="sm" className="h-8 gap-2" onClick={openCreateDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  New Chain
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">Loading chains...</div>
              ) : error ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-destructive/10 bg-destructive/5 p-4 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : sortedChains.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-60">
                  <GitBranch className="mb-2 h-10 w-10 opacity-20" />
                  <p className="text-sm">No command chains yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedChains.map((chain) => {
                    const isActive = chain.id === selectedChain?.id
                    const latestRun = chainRuns[chain.id]

                    return (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => setSelectedChainId(chain.id)}
                        className={cn(
                          'group flex w-full flex-col gap-2 rounded-lg px-3 py-3 text-left transition-all',
                          isActive
                            ? 'bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-bold">{chain.name}</span>
                          <Badge variant="outline" className="text-[9px] font-medium">
                            {chain.steps.length} steps
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-[10px] opacity-70">
                          <span className="truncate">{chain.projectId ? projectsById[chain.projectId]?.name ?? 'Removed project' : 'Global chain'}</span>
                          <span>{new Date(chain.updatedAt).toLocaleDateString()}</span>
                        </div>

                        {latestRun ? (
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className={cn('rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.14em]', statusStyles[latestRun.status])}>
                              {latestRun.status}
                            </span>
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedChain ? (
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded bg-primary/10 p-1.5 text-primary border border-primary/20">
                        <GitBranch className="h-4 w-4" />
                      </div>
                      <CardTitle className="truncate text-2xl font-bold tracking-tight">{selectedChain.name}</CardTitle>
                    </div>
                    <CardDescription className="max-w-3xl text-[13px] leading-relaxed">
                      {selectedChain.description || 'Run this saved command sequence as a repeatable automation workflow.'}
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {selectedChain.steps.length} steps
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {selectedChain.projectId ? projectsById[selectedChain.projectId]?.name ?? 'Removed project' : 'Global chain'}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {selectedChain.stopOnFailure ? 'Stop on failure' : 'Continue on failure'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={openEditDialog}>Edit Chain</Button>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto p-8 pt-6 space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Chain Steps</Label>
                    <Badge variant="outline" className="text-[9px] font-mono opacity-60">Sequential</Badge>
                  </div>

                  <div className="space-y-3">
                    {selectedChain.steps.map((step, index) => {
                      const command = commandsById[step.commandId]
                      const stepRun = selectedRun?.steps.find((entry) => entry.stepId === step.id)

                      return (
                        <div key={step.id} className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                                  Step {index + 1}
                                </Badge>
                                {stepRun ? (
                                  <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]', stepStatusStyles[stepRun.status])}>
                                    {stepRun.status}
                                  </span>
                                ) : null}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{command?.name ?? 'Removed command'}</p>
                                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                                  {command?.command ?? 'This step references a deleted command.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 text-[10px] text-muted-foreground">
                              {step.delayMs ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-1">
                                  <Clock3 className="h-3 w-3" />
                                  {step.delayMs}ms delay
                                </span>
                              ) : null}
                              {step.variables && Object.keys(step.variables).length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-1">
                                  <Link2 className="h-3 w-3" />
                                  {Object.keys(step.variables).length} override{Object.keys(step.variables).length === 1 ? '' : 's'}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {stepRun?.error ? <p className="mt-3 text-xs text-destructive">{stepRun.error}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Latest Run Progress</Label>
                  {selectedRun ? (
                    <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', statusStyles[selectedRun.status])}>
                          {selectedRun.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Started {new Date(selectedRun.startedAt).toLocaleString()}
                        </span>
                      </div>
                      {selectedRun.error ? <p className="mt-3 text-xs text-destructive">{selectedRun.error}</p> : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                      Run this chain to stream per-step progress here. Each step also lands in run history.
                    </div>
                  )}
                </div>
              </CardContent>

              <div className="border-t border-border/40 bg-muted/5 p-6">
                <div className="flex flex-col gap-4">
                  {!selectedChain.projectId ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="chain-run-project" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                        Runtime Project
                      </Label>
                      <select
                        id="chain-run-project"
                        className="flex h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm"
                        value={runProjectId ?? ''}
                        onChange={(event) => setRunProjectId(event.target.value)}
                      >
                        <option value="">Select project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {runError ? <p className="text-xs text-destructive">{runError}</p> : null}

                  <div className="flex justify-end gap-3">
                    <Button
                      className="h-10 gap-2 px-6 font-bold uppercase tracking-wider text-[11px]"
                      onClick={handleRun}
                      disabled={selectedRun?.status === 'running' || (requiresProjectSelection && !runProjectId)}
                    >
                      {selectedRun?.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      {selectedRun?.status === 'running' ? 'Running Chain...' : 'Run Chain'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
              <div className="max-w-[260px] space-y-4 opacity-50">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border/40 bg-muted/20">
                  <GitBranch className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Command Chains</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Select a chain to inspect execution order, tune steps, and launch multi-step automations.</p>
                </div>
              </div>
            </Card>
          )
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create command chain' : 'Edit command chain'}</DialogTitle>
            <DialogDescription>Compose commands into a saved sequence with per-step overrides and delays.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="chain-name">Name</Label>
                <Input id="chain-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Ship staging build" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chain-project">Bound Project</Label>
                <select
                  id="chain-project"
                  className="flex h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm"
                  value={draftProjectId}
                  onChange={(event) => setDraftProjectId(event.target.value)}
                >
                  <option value={GLOBAL_PROJECT_VALUE}>Global</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chain-description">Description</Label>
              <Textarea
                id="chain-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="Install dependencies, run tests, then build the app."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Failure behavior</p>
                <p className="text-xs text-muted-foreground">Choose whether the chain stops immediately when a step fails.</p>
              </div>
              <Button variant={draftStopOnFailure ? 'default' : 'outline'} onClick={() => setDraftStopOnFailure((current) => !current)}>
                {draftStopOnFailure ? 'Stop On Failure' : 'Continue On Failure'}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setDraftSteps((current) => [...current, createDraftStep()])}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Step
                </Button>
              </div>

              <ScrollArea className="max-h-[420px] rounded-2xl border border-border/50 bg-muted/10 p-4">
                <div className="space-y-4">
                  {draftSteps.map((step, index) => (
                    <div key={step.id} className="rounded-2xl border border-border/50 bg-background/80 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                            Step {index + 1}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Select a saved command and optional overrides.</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveDraftStep(step.id, -1)} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveDraftStep(step.id, 1)} disabled={index === draftSteps.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDraftSteps((current) => current.filter((entry) => entry.id !== step.id))}
                            disabled={draftSteps.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1.4fr,0.6fr]">
                        <div className="space-y-2">
                          <Label>Command</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={step.commandId}
                            onChange={(event) => updateDraftStep(step.id, { commandId: event.target.value })}
                          >
                            <option value="">Select command</option>
                            {commandOptions.map((command) => (
                              <option key={command.id} value={command.id}>
                                {command.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>Delay (ms)</Label>
                          <Input value={step.delayMs} onChange={(event) => updateDraftStep(step.id, { delayMs: event.target.value })} placeholder="0" />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label>Variables Overrides</Label>
                        <Textarea
                          value={step.variablesText}
                          onChange={(event) => updateDraftStep(step.id, { variablesText: event.target.value })}
                          placeholder={"TAG=v1.2.0\nENV=staging"}
                          rows={3}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {dialogError ? <p className="text-xs text-destructive">{dialogError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={savePending}>Cancel</Button>
            <Button onClick={handleSave} disabled={savePending}>
              {savePending ? 'Saving...' : dialogMode === 'create' ? 'Create Chain' : 'Save Chain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chain?</DialogTitle>
            <DialogDescription>This removes the saved chain definition but keeps the underlying commands and run history.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletePending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting...' : 'Delete Chain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
