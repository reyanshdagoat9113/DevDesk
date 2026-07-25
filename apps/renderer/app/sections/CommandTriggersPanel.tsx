import { useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, Clock3, PlayCircle, Plus, Trash2, Zap } from 'lucide-react'

import { Badge } from '../components/ui/Badge'
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
import { SectionLayout } from '../layout/SectionLayout'
import { Textarea } from '../components/ui/Textarea'
import { cn } from '../../lib/utils'
import type {
  CommandChain,
  CommandTrigger,
  CommandTriggerEvent,
  CreateCommandTriggerInput,
  Project,
} from '../types'

const GLOBAL_PROJECT_VALUE = '__global__'

const triggerEventLabels: Record<CommandTriggerEvent, { label: string; description: string }> = {
  onProjectOpen: {
    label: 'On Project Open',
    description: 'Runs when a project is selected in the Projects view.',
  },
  afterContainerStart: {
    label: 'After Container Start',
    description: 'Runs after linked containers start or restart.',
  },
  onStartup: {
    label: 'On Startup',
    description: 'Runs when DevDesk launches.',
  },
}

type CommandTriggersPanelProps = {
  triggers: CommandTrigger[]
  chains: CommandChain[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onCreateTrigger: (input: CreateCommandTriggerInput) => Promise<CommandTrigger>
  onUpdateTrigger: (triggerId: string, input: CreateCommandTriggerInput) => Promise<CommandTrigger>
  onRemoveTrigger: (triggerId: string) => Promise<void>
}

export function CommandTriggersPanel({
  triggers,
  chains,
  projects,
  isLoading,
  error,
  onCreateTrigger,
  onUpdateTrigger,
  onRemoveTrigger,
}: CommandTriggersPanelProps) {
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(triggers[0]?.id ?? null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftProjectId, setDraftProjectId] = useState<string>(GLOBAL_PROJECT_VALUE)
  const [draftChainId, setDraftChainId] = useState('')
  const [draftEvent, setDraftEvent] = useState<CommandTriggerEvent>('onProjectOpen')
  const [draftEnabled, setDraftEnabled] = useState(true)
  const [draftRequireConfirmation, setDraftRequireConfirmation] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    if (!triggers.length) {
      setSelectedTriggerId(null)
      return
    }

    if (!selectedTriggerId || !triggers.some((trigger) => trigger.id === selectedTriggerId)) {
      setSelectedTriggerId(triggers[0].id)
    }
  }, [selectedTriggerId, triggers])

  const sortedTriggers = useMemo(
    () => [...triggers].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [triggers]
  )

  const selectedTrigger = useMemo(
    () => sortedTriggers.find((trigger) => trigger.id === selectedTriggerId) ?? sortedTriggers[0] ?? null,
    [selectedTriggerId, sortedTriggers]
  )

  const chainsById = useMemo(
    () => chains.reduce<Record<string, CommandChain>>((acc, chain) => ({ ...acc, [chain.id]: chain }), {}),
    [chains]
  )

  const projectsById = useMemo(
    () => projects.reduce<Record<string, Project>>((acc, project) => ({ ...acc, [project.id]: project }), {}),
    [projects]
  )

  const openCreateDialog = () => {
    setDialogMode('create')
    setDraftName('')
    setDraftDescription('')
    setDraftProjectId(GLOBAL_PROJECT_VALUE)
    setDraftChainId(chains[0]?.id ?? '')
    setDraftEvent('onProjectOpen')
    setDraftEnabled(true)
    setDraftRequireConfirmation(false)
    setDialogError(null)
    setDialogOpen(true)
  }

  const openEditDialog = () => {
    if (!selectedTrigger) {
      return
    }

    setDialogMode('edit')
    setDraftName(selectedTrigger.name)
    setDraftDescription(selectedTrigger.description ?? '')
    setDraftProjectId(selectedTrigger.projectId ?? GLOBAL_PROJECT_VALUE)
    setDraftChainId(selectedTrigger.chainId)
    setDraftEvent(selectedTrigger.event)
    setDraftEnabled(selectedTrigger.enabled)
    setDraftRequireConfirmation(selectedTrigger.requireConfirmation)
    setDialogError(null)
    setDialogOpen(true)
  }

  const buildInput = (): CreateCommandTriggerInput => {
    const name = draftName.trim()
    if (!name) {
      throw new Error('Trigger name is required.')
    }

    if (!draftChainId) {
      throw new Error('Select a chain for this trigger.')
    }

    return {
      name,
      description: draftDescription.trim() || undefined,
      projectId: draftProjectId === GLOBAL_PROJECT_VALUE ? undefined : draftProjectId,
      chainId: draftChainId,
      event: draftEvent,
      enabled: draftEnabled,
      requireConfirmation: draftRequireConfirmation,
    }
  }

  const handleSave = async () => {
    setDialogError(null)
    setSavePending(true)
    try {
      const input = buildInput()
      const saved =
        dialogMode === 'create'
          ? await onCreateTrigger(input)
          : await onUpdateTrigger(selectedTrigger?.id ?? '', input)
      setSelectedTriggerId(saved.id)
      setDialogOpen(false)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Failed to save trigger.')
    } finally {
      setSavePending(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTrigger) {
      return
    }

    setDeleteError(null)
    setDeletePending(true)
    try {
      await onRemoveTrigger(selectedTrigger.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete trigger.')
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <SectionLayout
        list={
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Triggers</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Run command chains from app events.</p>
                </div>
                <Button size="sm" className="h-8 gap-2" onClick={openCreateDialog} disabled={chains.length === 0}>
                  <Plus className="h-3.5 w-3.5" />
                  New Trigger
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">Loading triggers...</div>
              ) : error ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-destructive/10 bg-destructive/5 p-4 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : sortedTriggers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-60">
                  <BellRing className="mb-2 h-10 w-10 opacity-20" />
                  <p className="text-sm">No triggers configured yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedTriggers.map((trigger) => {
                    const isActive = trigger.id === selectedTrigger?.id
                    const chain = chainsById[trigger.chainId]
                    return (
                      <button
                        key={trigger.id}
                        type="button"
                        onClick={() => setSelectedTriggerId(trigger.id)}
                        className={cn(
                          'group flex w-full flex-col gap-2 rounded-lg px-3 py-3 text-left transition-all',
                          isActive
                            ? 'bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-bold">{trigger.name}</span>
                          <Badge variant={trigger.enabled ? 'secondary' : 'outline'} className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                            {trigger.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="text-[10px] opacity-70">{triggerEventLabels[trigger.event].label}</div>
                        <div className="truncate text-[10px] opacity-70">{chain?.name ?? 'Removed chain'}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedTrigger ? (
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded bg-primary/10 p-1.5 text-primary border border-primary/20">
                        <Zap className="h-4 w-4" />
                      </div>
                      <CardTitle className="truncate text-2xl font-bold tracking-tight">{selectedTrigger.name}</CardTitle>
                    </div>
                    <CardDescription>
                      {selectedTrigger.description || triggerEventLabels[selectedTrigger.event].description}
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {triggerEventLabels[selectedTrigger.event].label}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {selectedTrigger.projectId ? projectsById[selectedTrigger.projectId]?.name ?? 'Removed project' : 'Global'}
                      </Badge>
                      <Badge variant={selectedTrigger.enabled ? 'success' : 'outline'} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {selectedTrigger.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {selectedTrigger.requireConfirmation ? (
                        <Badge variant="warning" className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                          Confirmation Required
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={openEditDialog}>Edit Trigger</Button>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-6 overflow-auto p-8 pt-6">
                <div className="rounded-2xl border border-border/50 bg-muted/10 p-5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Linked Chain</p>
                  <div className="mt-3">
                    <p className="text-lg font-semibold">{chainsById[selectedTrigger.chainId]?.name ?? 'Removed chain'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {chainsById[selectedTrigger.chainId]?.description || 'This trigger starts the selected command chain.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/50 bg-muted/10 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <PlayCircle className="h-4 w-4 text-primary" />
                      Event Source
                    </div>
                    <p className="mt-3 text-sm">{triggerEventLabels[selectedTrigger.event].label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{triggerEventLabels[selectedTrigger.event].description}</p>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-muted/10 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Execution Safety
                    </div>
                    <p className="mt-3 text-sm">
                      {selectedTrigger.requireConfirmation ? 'User confirmation is required before this trigger runs.' : 'Runs immediately when the event fires.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
              <div className="max-w-[260px] space-y-4 opacity-50">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border/40 bg-muted/20">
                  <BellRing className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Command Triggers</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Attach saved chains to startup, project open, or linked container events.</p>
                </div>
              </div>
            </Card>
          )
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create trigger' : 'Edit trigger'}</DialogTitle>
            <DialogDescription>Automatically run a saved chain when a specific event occurs.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trigger-name">Name</Label>
              <Input id="trigger-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Open workspace bootstrap" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-description">Description</Label>
              <Textarea id="trigger-description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={3} placeholder="Runs setup steps whenever this project is opened." />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger-chain">Chain</Label>
                <select id="trigger-chain" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draftChainId} onChange={(event) => setDraftChainId(event.target.value)}>
                  <option value="">Select chain</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>{chain.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger-event">Event</Label>
                <select id="trigger-event" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draftEvent} onChange={(event) => setDraftEvent(event.target.value as CommandTriggerEvent)}>
                  {Object.entries(triggerEventLabels).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-project">Project Scope</Label>
              <select id="trigger-project" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draftProjectId} onChange={(event) => setDraftProjectId(event.target.value)}>
                <option value={GLOBAL_PROJECT_VALUE}>Global</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => setDraftEnabled((current) => !current)} className={cn('rounded-2xl border p-4 text-left transition-colors', draftEnabled ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/50 bg-muted/10 text-muted-foreground')}>
                <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Enabled</div>
                <p className="mt-1 text-xs">Disabled triggers stay saved but never run.</p>
              </button>
              <button type="button" onClick={() => setDraftRequireConfirmation((current) => !current)} className={cn('rounded-2xl border p-4 text-left transition-colors', draftRequireConfirmation ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/50 bg-muted/10 text-muted-foreground')}>
                <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4" /> Require Confirmation</div>
                <p className="mt-1 text-xs">Ask before running when the trigger fires.</p>
              </button>
            </div>

            {dialogError ? <p className="text-xs text-destructive">{dialogError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={savePending}>Cancel</Button>
            <Button onClick={handleSave} disabled={savePending}>{savePending ? 'Saving...' : dialogMode === 'create' ? 'Create Trigger' : 'Save Trigger'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete trigger?</DialogTitle>
            <DialogDescription>This removes the automation rule but keeps the chain and command history intact.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletePending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePending}>{deletePending ? 'Deleting...' : 'Delete Trigger'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
