import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Bug, Check, Loader2, Activity, Server, Container, FileText, Stethoscope, Command } from 'lucide-react'
import { Button } from './ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Textarea } from './ui/Textarea'
import { ScrollArea } from './ui/ScrollArea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'
import { cn } from '../../lib/utils'
import { severityLabels, isValidBugSeverity } from '../lib/bugConstants'
import type {
  BugSeverity,
  CreateBugReportInput,
  BugContextSnapshotData,
  Project,
} from '../types'

interface BugReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  preselectedProjectId?: string | null
  onSaved?: () => void
}

type ContextToggleKey = keyof Omit<BugContextSnapshotData, 'bugReportId'>

type ToggleConfig = {
  key: ContextToggleKey
  label: string
  icon: React.ReactNode
}

const contextToggles: ToggleConfig[] = [
  { key: 'runHistoryJson', label: 'Run History', icon: <Activity className="h-3 w-3" /> },
  { key: 'logsJson', label: 'Logs', icon: <Container className="h-3 w-3" /> },
  { key: 'environmentSnapshotJson', label: 'Environment', icon: <Server className="h-3 w-3" /> },
  { key: 'activeContainerStateJson', label: 'Container State', icon: <Container className="h-3 w-3" /> },
  { key: 'commandHistoryJson', label: 'Command History', icon: <Command className="h-3 w-3" /> },
  { key: 'healthSnapshotJson', label: 'Health Snapshot', icon: <Stethoscope className="h-3 w-3" /> },
  { key: 'notesSnippetJson', label: 'Notes Snippet', icon: <FileText className="h-3 w-3" /> },
]

const defaultActiveToggles: Record<ContextToggleKey, boolean> = {
  runHistoryJson: true,
  logsJson: true,
  environmentSnapshotJson: true,
  activeContainerStateJson: true,
  commandHistoryJson: false,
  healthSnapshotJson: false,
  notesSnippetJson: false,
}

export function BugReportModal({
  open,
  onOpenChange,
  projects,
  preselectedProjectId,
  onSaved,
}: BugReportModalProps) {
  const [projectId, setProjectId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('medium')
  const [expectedResult, setExpectedResult] = useState('')
  const [actualResult, setActualResult] = useState('')
  const [reproductionSteps, setReproductionSteps] = useState('')
  const [notes, setNotes] = useState('')

  const [includeContext, setIncludeContext] = useState(false)
  const [activeToggles, setActiveToggles] = useState<Record<ContextToggleKey, boolean>>({ ...defaultActiveToggles })

  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const wasOpenRef = useRef(open)

  const resetForm = useCallback(() => {
    setProjectId('')
    setTitle('')
    setSeverity('medium')
    setExpectedResult('')
    setActualResult('')
    setReproductionSteps('')
    setNotes('')
    setIncludeContext(false)
    setActiveToggles({ ...defaultActiveToggles })
    setFormError(null)
  }, [])

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm()
      if (preselectedProjectId && projects.some((p) => p.id === preselectedProjectId)) {
        setProjectId(preselectedProjectId)
      } else if (projects.length === 1) {
        setProjectId(projects[0].id)
      } else {
        setProjectId('')
      }
    }
    wasOpenRef.current = open
  }, [open, preselectedProjectId, projects, resetForm])

  const toggleContextItem = (key: ContextToggleKey) => {
    setActiveToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError('Title is required.')
      return
    }
    if (!projectId) {
      setFormError('Please select a project.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      let contextSnapshot: BugContextSnapshotData | undefined

      if (includeContext) {
        const enabledKeys = Object.entries(activeToggles)
          .filter(([, v]) => v)
          .map(([k]) => k as ContextToggleKey)

        if (enabledKeys.length > 0) {
          const captureResult = await window.electronAPI.captureContext(projectId)
          if (captureResult.ok) {
            const data = captureResult.data
            contextSnapshot = {
              commandHistoryJson: activeToggles.commandHistoryJson ? data.commandHistoryJson : '',
              runHistoryJson: activeToggles.runHistoryJson ? data.runHistoryJson : '',
              logsJson: activeToggles.logsJson ? data.logsJson : '',
              environmentSnapshotJson: activeToggles.environmentSnapshotJson ? data.environmentSnapshotJson : '',
              activeContainerStateJson: activeToggles.activeContainerStateJson ? data.activeContainerStateJson : '',
              healthSnapshotJson: activeToggles.healthSnapshotJson ? data.healthSnapshotJson : '',
              notesSnippetJson: activeToggles.notesSnippetJson ? data.notesSnippetJson : '',
            }
          } else {
            setFormError(`Context capture failed: ${captureResult.error.message}`)
            setSaving(false)
            return
          }
        }
      }

      const input: CreateBugReportInput = {
        projectId,
        title: trimmedTitle,
        severity,
        status: 'open',
        expectedResult: expectedResult.trim() || undefined,
        actualResult: actualResult.trim() || undefined,
        reproductionSteps: reproductionSteps.trim() || undefined,
        notes: notes.trim() || undefined,
        contextSnapshot,
      }

      const result = await window.electronAPI.createBug(input)
      if (result.ok) {
        onOpenChange(false)
        resetForm()
        onSaved?.()
      } else {
        setFormError(result.error.message)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save bug report.')
    } finally {
      setSaving(false)
    }
  }, [
    title,
    projectId,
    severity,
    expectedResult,
    actualResult,
    reproductionSteps,
    notes,
    includeContext,
    activeToggles,
    onOpenChange,
    resetForm,
    onSaved,
  ])

  const handleOpenChange = (isOpen: boolean) => {
    if (saving && !isOpen) return
    onOpenChange(isOpen)
    if (!isOpen) resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] flex flex-col p-0"
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (saving) e.preventDefault()
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <DialogTitle>Record Bug</DialogTitle>
          </div>
          <DialogDescription>Quickly capture a bug report with optional context.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
        >
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 py-2 pb-4">
              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-project"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Project <span className="text-destructive">*</span>
                </Label>
                <Select value={projectId} onValueChange={setProjectId} disabled={saving}>
                  <SelectTrigger id="bug-modal-project" className="h-9 text-sm">
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No projects available.</div>
                    )}
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-title"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bug-modal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary of the bug"
                  className="h-9 text-sm"
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-severity"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Severity
                </Label>
                <Select
                  value={severity}
                  onValueChange={(value) => {
                    if (isValidBugSeverity(value)) {
                      setSeverity(value)
                    }
                  }}
                  disabled={saving}
                >
                  <SelectTrigger id="bug-modal-severity" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{severityLabels.low}</SelectItem>
                    <SelectItem value="medium">{severityLabels.medium}</SelectItem>
                    <SelectItem value="high">{severityLabels.high}</SelectItem>
                    <SelectItem value="critical">{severityLabels.critical}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-expected"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Expected Result
                </Label>
                <Textarea
                  id="bug-modal-expected"
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  placeholder="What should have happened?"
                  className="min-h-[70px] text-sm"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-actual"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Actual Result
                </Label>
                <Textarea
                  id="bug-modal-actual"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                  placeholder="What actually happened?"
                  className="min-h-[70px] text-sm"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-repro"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Reproduction Steps
                </Label>
                <Textarea
                  id="bug-modal-repro"
                  value={reproductionSteps}
                  onChange={(e) => setReproductionSteps(e.target.value)}
                  placeholder="Steps to reproduce the bug"
                  className="min-h-[70px] text-sm"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bug-modal-notes"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  Notes
                </Label>
                <Textarea
                  id="bug-modal-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes"
                  className="min-h-[70px] text-sm"
                  disabled={saving}
                />
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="context-toggle"
                    className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                  >
                    Context Snapshot
                  </Label>
                  <button
                    id="context-toggle"
                    type="button"
                    role="switch"
                    aria-checked={includeContext}
                    aria-label="Include context snapshot"
                    disabled={saving}
                    onClick={() => setIncludeContext((v) => !v)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      includeContext ? 'bg-primary' : 'bg-muted-foreground/30',
                      saving && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform',
                        includeContext ? 'translate-x-4' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                {includeContext && (
                  <div className="flex flex-wrap gap-2">
                    {contextToggles.map((item) => {
                      const active = activeToggles[item.key]
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={active}
                          disabled={saving}
                          onClick={() => toggleContextItem(item.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                            active
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border/60 bg-background/50 text-muted-foreground hover:text-foreground',
                            saving && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {active ? <Check className="h-3 w-3" /> : item.icon}
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {formError && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border/30">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Saving...' : 'Save Bug Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
