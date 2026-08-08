import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bug,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Paperclip,
  X,
  Search,
  SlidersHorizontal,
  Eye,
} from 'lucide-react'
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
import { ErrorState } from './ui/ErrorState'
import { LoadingState } from './ui/LoadingState'
import { StatusNotice } from './ui/StatusNotice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'
import { cn } from '@/lib/utils'
import { severityBadgeVariant, severityLabels, statusBadgeVariant, statusLabels } from '../lib/bugConstants'
import { attachmentKindIcon, formatDate, formatFileSize } from '../lib/formatters'
import { BugReportDetail } from './BugReportDetail'
import type { BugAttachment, BugReport, BugSeverity, BugStatus, CreateBugReportInput } from '../types'

interface BugRecorderPanelProps {
  projectId: string
}

const statusOrder: BugStatus[] = ['open', 'in_progress', 'resolved', 'closed']

const selectBaseClass =
  'h-8 rounded-md border border-input bg-background/70 px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function BugRecorderPanel({ projectId }: BugRecorderPanelProps) {
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BugReport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [updatingBugId, setUpdatingBugId] = useState<string | null>(null)
  const [attachmentsByBug, setAttachmentsByBug] = useState<Record<string, BugAttachment[]>>({})
  const [addingAttachmentForBug, setAddingAttachmentForBug] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | BugStatus>('all')
  const [filterSeverity, setFilterSeverity] = useState<'all' | BugSeverity>('all')
  const [filterDateRange, setFilterDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all')

  const [detailBugId, setDetailBugId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const detailBug = useMemo(
    () => bugs.find((b) => b.id === detailBugId) ?? null,
    [bugs, detailBugId]
  )

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

        // Merge new attachment data with existing to avoid flicker on partial failure
        const attachmentMap: Record<string, BugAttachment[]> = {}
        await Promise.all(
          result.data.map(async (bug) => {
            const attResult = await window.electronAPI.listBugAttachments(bug.id)
            if (attResult.ok) {
              attachmentMap[bug.id] = attResult.data
            }
          })
        )
        setAttachmentsByBug((prev) => {
          const next = { ...prev }
          for (const bug of result.data) {
            if (attachmentMap[bug.id] !== undefined) {
              next[bug.id] = attachmentMap[bug.id]
            }
          }
          return next
        })
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

  // Close detail dialog if the referenced bug is deleted or no longer exists
  useEffect(() => {
    if (detailBugId && !bugs.some((b) => b.id === detailBugId)) {
      setDetailBugId(null)
      setDetailOpen(false)
    }
  }, [bugs, detailBugId])

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

  const handleCreate = useCallback(async () => {
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
        setSuccessMessage('Bug report saved.')
      } else {
        setFormError(result.error.message)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create bug report.')
    } finally {
      setSaving(false)
    }
  }, [projectId, title, severity, expectedResult, actualResult, reproductionSteps, notes, resetForm, loadBugs])

  const handleStatusChange = useCallback(async (bugId: string, nextStatus: BugStatus) => {
    setUpdatingBugId(bugId)
    setError(null)
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
        setSuccessMessage('Bug status updated.')
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.')
    } finally {
      setUpdatingBugId(null)
    }
  }, [])

  const openDeleteDialog = useCallback((bug: BugReport) => {
    setDeleteTarget(bug)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    const bugId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await window.electronAPI.deleteBug(bugId)
      if (result.ok) {
        if (detailBugId === bugId) {
          setDetailBugId(null)
          setDetailOpen(false)
        }
        await loadBugs()
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        setSuccessMessage(`Deleted “${deleteTarget.title}”.`)
      } else {
        setDeleteError(result.error.message)
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete bug report.')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, detailBugId, loadBugs])

  const handleAddAttachment = useCallback(async (bugId: string) => {
    setAddingAttachmentForBug(bugId)
    try {
      const pickResult = await window.electronAPI.pickAttachmentFile({
        title: 'Attach files to bug report',
      })
      if (!pickResult.ok || pickResult.data.canceled || pickResult.data.filePaths.length === 0) {
        return
      }

      const errors: string[] = []
      for (const filePath of pickResult.data.filePaths) {
        const addResult = await window.electronAPI.addBugAttachment({
          bugReportId: bugId,
          sourceFilePath: filePath,
        })
        if (!addResult.ok) {
          errors.push(addResult.error.message)
        }
      }

      const listResult = await window.electronAPI.listBugAttachments(bugId)
      if (listResult.ok) {
        setAttachmentsByBug((prev) => ({ ...prev, [bugId]: listResult.data }))
      }

      if (errors.length > 0) {
        setError(errors.join('; '))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add attachment.')
    } finally {
      setAddingAttachmentForBug(null)
    }
  }, [])

  const handleRemoveAttachment = useCallback(async (bugId: string, attachmentId: string) => {
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
  }, [])

  const handleOpenDetail = useCallback((bug: BugReport) => {
    setDetailBugId(bug.id)
    setDetailOpen(true)
  }, [])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setFilterStatus('all')
    setFilterSeverity('all')
    setFilterDateRange('all')
  }, [])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterStatus !== 'all' ||
    filterSeverity !== 'all' ||
    filterDateRange !== 'all'

  const filteredBugs = useMemo(() => {
    let result = bugs

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (bug) =>
          bug.title.toLowerCase().includes(q) ||
          (bug.expectedResult?.toLowerCase().includes(q) ?? false) ||
          (bug.actualResult?.toLowerCase().includes(q) ?? false) ||
          (bug.reproductionSteps?.toLowerCase().includes(q) ?? false) ||
          (bug.notes?.toLowerCase().includes(q) ?? false) ||
          (bug.resolutionNotes?.toLowerCase().includes(q) ?? false)
      )
    }

    if (filterStatus !== 'all') {
      result = result.filter((bug) => bug.status === filterStatus)
    }

    if (filterSeverity !== 'all') {
      result = result.filter((bug) => bug.severity === filterSeverity)
    }

    if (filterDateRange !== 'all') {
      const now = Date.now()
      const msPerDay = 24 * 60 * 60 * 1000
      const days =
        filterDateRange === '7d' ? 7 : filterDateRange === '30d' ? 30 : 90
      const cutoff = now - days * msPerDay
      result = result.filter((bug) => new Date(bug.createdAt).getTime() > cutoff)
    }

    return result
  }, [bugs, searchQuery, filterStatus, filterSeverity, filterDateRange])

  const groupedBugs = useMemo(() => {
    const groups: Record<BugStatus, BugReport[]> = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    }
    for (const bug of filteredBugs) {
      groups[bug.status].push(bug)
    }
    return groups
  }, [filteredBugs])

  const totalFilteredCount = filteredBugs.length
  const totalCount = bugs.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Bug Reports
          </h3>
          {totalCount > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {totalFilteredCount}
              {hasActiveFilters ? ` / ${totalCount}` : ''}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="h-8 gap-2 text-[11px] font-semibold"
          onClick={handleOpenDialog}
        >
          <Plus className="h-3.5 w-3.5" />
          Report Bug
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, steps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />

          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | BugStatus)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSeverity} onValueChange={(value) => setFilterSeverity(value as 'all' | BugSeverity)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDateRange} onValueChange={(value) => setFilterDateRange(value as typeof filterDateRange)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {successMessage ? (
        <StatusNotice tone="success" title="Bug recorder updated" className="mb-3" onClick={() => setSuccessMessage(null)}>
          {successMessage}
        </StatusNotice>
      ) : null}
      {error ? <ErrorState title="Bug recorder action failed" description={error} onRetry={() => void loadBugs()} retryLabel="Retry loading bugs" className="min-h-0 py-4" /> : null}

      {loading ? (
        <LoadingState label="Loading bug reports" description="Loading bug reports…" className="rounded-lg border border-border/40 bg-card" />
      ) : filteredBugs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/40 bg-muted/20 p-10 text-muted-foreground">
          <Bug className="h-8 w-8 opacity-50" />
          <p className="text-sm">
            {hasActiveFilters ? 'No bugs match your filters.' : 'No bug reports yet.'}
          </p>
          {hasActiveFilters ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-2 text-[11px] font-semibold"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-2 text-[11px] font-semibold"
              onClick={handleOpenDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              Report your first bug
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {statusOrder.map((status) => {
            const group = groupedBugs[status]
            if (group.length === 0) return null

            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    {statusLabels[status]}
                  </h4>
                  <Badge
                    variant={statusBadgeVariant[status]}
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {group.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {group.map((bug) => (
                    <div
                      key={bug.id}
                      className="rounded-lg border border-border/40 bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="min-w-0 flex-1 space-y-1 cursor-pointer"
                          onClick={() => handleOpenDetail(bug)}
                        >
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
                            {attachmentsByBug[bug.id]?.length > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {attachmentsByBug[bug.id].length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            value={bug.status}
                            onValueChange={(value) => void handleStatusChange(bug.id, value as BugStatus)}
                            disabled={updatingBugId === bug.id}
                          >
                            <SelectTrigger className={cn(selectBaseClass, 'w-[120px] cursor-pointer')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(bug)}
                            aria-label="Delete bug report"
                            title="Delete bug report"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Quick fields preview */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        {bug.expectedResult && (
                          <span className="rounded bg-muted/30 px-1.5 py-0.5">Expected</span>
                        )}
                        {bug.actualResult && (
                          <span className="rounded bg-muted/30 px-1.5 py-0.5">Actual</span>
                        )}
                        {bug.reproductionSteps && (
                          <span className="rounded bg-muted/30 px-1.5 py-0.5">Steps</span>
                        )}
                        {bug.notes && (
                          <span className="rounded bg-muted/30 px-1.5 py-0.5">Notes</span>
                        )}
                        <button
                          className="ml-auto flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          onClick={() => handleOpenDetail(bug)}
                        >
                          <Eye className="h-3 w-3" />
                          View details
                        </button>
                      </div>

                      {/* Attachments */}
                      <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            Attachments
                            {attachmentsByBug[bug.id]?.length > 0 && (
                              <span className="text-muted-foreground/60">
                                ({attachmentsByBug[bug.id].length})
                              </span>
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
                                <span className="text-muted-foreground/60">
                                  {formatFileSize(att.fileSize)}
                                </span>
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
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
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

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bug report?</DialogTitle>
            <DialogDescription>
              This permanently removes “{deleteTarget?.title ?? 'this bug report'}” from the current project, including its stored attachments and captured context. Copy anything you need before deleting; there is no undo.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <StatusNotice tone="error" title="Bug report was not deleted">{deleteError}</StatusNotice> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting || !deleteTarget}>
              {deleting ? 'Deleting…' : 'Delete bug report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailBug && (
        <BugReportDetail
          bug={detailBug}
          attachments={attachmentsByBug[detailBug.id] ?? []}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open)
            if (!open) setDetailBugId(null)
          }}
        />
      )}
    </div>
  )
}
