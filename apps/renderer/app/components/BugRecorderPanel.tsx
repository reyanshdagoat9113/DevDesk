import { useCallback, useEffect, useState } from 'react'
import { Bug, Loader2, Plus, Trash2, AlertCircle, Paperclip, X, FileText, Image, File } from 'lucide-react'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
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
import { severityBadgeVariant, severityLabels } from '../lib/bugConstants'
import type { BugAttachment, BugReport, BugSeverity, BugStatus, CreateBugReportInput } from '../types'

interface BugRecorderPanelProps {
  projectId: string
}

function attachmentKindIcon(kind: string) {
  switch (kind) {
    case 'screenshot':
      return <Image className="h-3 w-3" />
    case 'log':
      return <FileText className="h-3 w-3" />
    default:
      return <File className="h-3 w-3" />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BugRecorderPanel({ projectId }: BugRecorderPanelProps) {
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [attachmentsByBug, setAttachmentsByBug] = useState<Record<string, BugAttachment[]>>({})
  const [addingAttachmentForBug, setAddingAttachmentForBug] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('medium')
  const [expectedResult, setExpectedResult] = useState('')
  const [actualResult, setActualResult] = useState('')
  const [reproductionSteps, setReproductionSteps] = useState('')
  const [notes, setNotes] = useState('')

  const loadBugs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.listBugs({ projectId })
      if (result.ok) {
        setBugs(result.data)
        const attachmentMap: Record<string, BugAttachment[]> = {}
        await Promise.all(
          result.data.map(async (bug) => {
            const attResult = await window.electronAPI.listBugAttachments(bug.id)
            if (attResult.ok) {
              attachmentMap[bug.id] = attResult.data
            }
          })
        )
        setAttachmentsByBug(attachmentMap)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bug reports.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadBugs()
  }, [loadBugs])

  const resetForm = useCallback(() => {
    setTitle('')
    setSeverity('medium')
    setExpectedResult('')
    setActualResult('')
    setReproductionSteps('')
    setNotes('')
    setFormError(null)
  }, [])

  const handleOpenDialog = useCallback(() => {
    resetForm()
    setDialogOpen(true)
  }, [resetForm])

  const handleCreate = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError('Title is required.')
      return
    }

    setSaving(true)
    setFormError(null)

    const input: CreateBugReportInput = {
      projectId,
      title: trimmedTitle,
      severity,
      status: 'open',
      expectedResult: expectedResult.trim() || undefined,
      actualResult: actualResult.trim() || undefined,
      reproductionSteps: reproductionSteps.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      const result = await window.electronAPI.createBug(input)
      if (result.ok) {
        setDialogOpen(false)
        resetForm()
        await loadBugs()
      } else {
        setFormError(result.error.message)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create bug report.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (bugId: string, nextStatus: BugStatus) => {
    try {
      const result = await window.electronAPI.updateBug(bugId, { status: nextStatus })
      if (result.ok) {
        setBugs((prev) =>
          prev.map((bug) =>
            bug.id === bugId
              ? { ...bug, status: nextStatus, updatedAt: result.data.updatedAt }
              : bug
          )
        )
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  const handleDelete = async (bugId: string) => {
    try {
      const result = await window.electronAPI.deleteBug(bugId)
      if (result.ok) {
        await loadBugs()
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bug report.')
    }
  }

  const handleAddAttachment = async (bugId: string) => {
    setAddingAttachmentForBug(bugId)
    try {
      const pickResult = await window.electronAPI.pickAttachmentFile({
        title: 'Attach files to bug report',
      })
      if (!pickResult.ok || pickResult.data.canceled || pickResult.data.filePaths.length === 0) {
        return
      }

      for (const filePath of pickResult.data.filePaths) {
        const addResult = await window.electronAPI.addBugAttachment({
          bugReportId: bugId,
          sourceFilePath: filePath,
        })
        if (!addResult.ok) {
          setError(addResult.error.message)
          return
        }
      }

      const listResult = await window.electronAPI.listBugAttachments(bugId)
      if (listResult.ok) {
        setAttachmentsByBug((prev) => ({ ...prev, [bugId]: listResult.data }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add attachment.')
    } finally {
      setAddingAttachmentForBug(null)
    }
  }

  const handleRemoveAttachment = async (bugId: string, attachmentId: string) => {
    try {
      const result = await window.electronAPI.removeBugAttachment(attachmentId)
      if (result.ok) {
        setAttachmentsByBug((prev) => ({
          ...prev,
          [bugId]: (prev[bugId] ?? []).filter((a) => a.id !== attachmentId),
        }))
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment.')
    }
  }

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return value
    }
  }

  const selectBaseClass =
    'h-8 rounded-md border border-input bg-background/70 px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Bug Reports
        </h3>
        <Button
          size="sm"
          className="h-8 gap-2 text-[11px] font-semibold"
          onClick={handleOpenDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          Report Bug
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bug reports...
          </div>
        </div>
      ) : bugs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/5 p-10 gap-3 text-muted-foreground">
          <Bug className="h-8 w-8 opacity-50" />
          <p className="text-sm">No bug reports yet.</p>
          <Button size="sm" variant="outline" className="h-8 gap-2 text-[11px] font-semibold" onClick={handleOpenDialog}>
            <Plus className="h-3.5 w-3.5" />
            Report your first bug
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bugs.map((bug) => (
            <div
              key={bug.id}
              className="rounded-lg border border-border/40 bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold truncate">{bug.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={severityBadgeVariant[bug.severity]}
                      className="text-[10px] uppercase tracking-wider h-5"
                    >
                      {severityLabels[bug.severity]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(bug.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label="Change status"
                    className={cn(selectBaseClass, 'cursor-pointer')}
                    value={bug.status}
                    onChange={(e) => void handleStatusChange(bug.id, e.target.value as BugStatus)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDelete(bug.id)}
                    aria-label="Delete bug report"
                    title="Delete bug report"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {(bug.expectedResult || bug.actualResult || bug.reproductionSteps || bug.notes) && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  {bug.expectedResult && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                        Expected Result
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{bug.expectedResult}</p>
                    </div>
                  )}
                  {bug.actualResult && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                        Actual Result
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{bug.actualResult}</p>
                    </div>
                  )}
                  {bug.reproductionSteps && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                        Reproduction Steps
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{bug.reproductionSteps}</p>
                    </div>
                  )}
                  {bug.notes && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
                        Notes
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{bug.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    Attachments
                    {attachmentsByBug[bug.id]?.length > 0 && (
                      <span className="text-muted-foreground/60">({attachmentsByBug[bug.id].length})</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => void handleAddAttachment(bug.id)}
                    disabled={addingAttachmentForBug === bug.id}
                  >
                    {addingAttachmentForBug === bug.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add
                  </Button>
                </div>
                {attachmentsByBug[bug.id]?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {attachmentsByBug[bug.id].map((att) => (
                      <div
                        key={att.id}
                        className="group flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[10px]"
                      >
                        {attachmentKindIcon(att.kind)}
                        <span className="truncate max-w-[120px]" title={att.fileName}>
                          {att.fileName}
                        </span>
                        <span className="text-muted-foreground/60">{formatFileSize(att.fileSize)}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5"
                          onClick={() => void handleRemoveAttachment(bug.id, att.id)}
                          aria-label={`Remove ${att.fileName}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/60">No attachments</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Bug</DialogTitle>
            <DialogDescription>Create a new bug report for this project.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="bug-title" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bug-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary of the bug"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-severity" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Severity
                </Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as BugSeverity)}>
                  <SelectTrigger id="bug-severity" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-expected" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Expected Result
                </Label>
                <Textarea
                  id="bug-expected"
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  placeholder="What should have happened?"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-actual" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Actual Result
                </Label>
                <Textarea
                  id="bug-actual"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                  placeholder="What actually happened?"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-repro" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Reproduction Steps
                </Label>
                <Textarea
                  id="bug-repro"
                  value={reproductionSteps}
                  onChange={(e) => setReproductionSteps(e.target.value)}
                  placeholder="Steps to reproduce the bug"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-notes" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Notes
                </Label>
                <Textarea
                  id="bug-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes"
                  className="min-h-[80px] text-sm"
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Bug Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
