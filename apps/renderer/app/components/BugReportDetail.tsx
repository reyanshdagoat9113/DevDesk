import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Box,
  ChevronDown,
  ChevronUp,
  Clock,
  Container,
  FileText,
  Globe,
  Logs,
  Paperclip,
  Play,
  Terminal,
} from 'lucide-react'
import { Badge } from './ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog'
import { ScrollArea } from './ui/ScrollArea'
import { severityBadgeVariant, severityLabels, statusBadgeVariant, statusLabels } from '../lib/bugConstants'
import { attachmentKindIcon, formatDateTime, formatFileSize } from '../lib/formatters'
import type {
  BugAttachment,
  BugContextSnapshot,
  BugReport,
} from '../types'

interface BugReportDetailProps {
  bug: BugReport
  attachments: BugAttachment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-border/30 px-3 py-3 text-sm">
          {children}
        </div>
      )}
    </div>
  )
}

function tryParseJson<T>(json: string | undefined): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

function tryParseJsonArray(json: string | undefined): unknown[] | null {
  const parsed = tryParseJson<unknown>(json)
  return Array.isArray(parsed) ? parsed : null
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 shrink-0 min-w-[100px]">
            {key}
          </span>
          <span className="text-xs text-muted-foreground break-all max-h-40 overflow-auto">
            {typeof value === 'string'
              ? value
              : JSON.stringify(value, null, 2)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ArrayList({ items, renderItem }: { items: unknown[]; renderItem: (item: unknown, index: number) => React.ReactNode }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No entries captured.</p>
  }
  return <div className="space-y-2">{items.map((item, i) => renderItem(item, i))}</div>
}

function ContextSnapshotView({ snapshot }: { snapshot: BugContextSnapshot }) {
  const commandHistory = useMemo(() => tryParseJsonArray(snapshot.commandHistoryJson), [snapshot.commandHistoryJson])
  const runHistory = useMemo(() => tryParseJsonArray(snapshot.runHistoryJson), [snapshot.runHistoryJson])
  const logs = useMemo(() => tryParseJsonArray(snapshot.logsJson), [snapshot.logsJson])
  const environment = useMemo(() => tryParseJson<Record<string, unknown>>(snapshot.environmentSnapshotJson), [snapshot.environmentSnapshotJson])
  const containers = useMemo(() => tryParseJsonArray(snapshot.activeContainerStateJson), [snapshot.activeContainerStateJson])
  const health = useMemo(() => tryParseJson<Record<string, unknown>>(snapshot.healthSnapshotJson), [snapshot.healthSnapshotJson])
  const notes = useMemo(() => tryParseJson<Record<string, unknown>>(snapshot.notesSnippetJson), [snapshot.notesSnippetJson])

  return (
    <div className="space-y-2">
      <CollapsibleSection title="Run History" icon={Play}>
        {runHistory ? (
          <ArrayList
            items={runHistory}
            renderItem={(item, i) => (
              <div key={i} className="rounded-md border border-border/30 bg-background/50 px-2.5 py-2 text-xs">
                {typeof item === 'object' && item !== null ? (
                  <KeyValueList data={item as Record<string, unknown>} />
                ) : (
                  String(item)
                )}
              </div>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">No run history captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Command History" icon={Terminal}>
        {commandHistory ? (
          <ArrayList
            items={commandHistory}
            renderItem={(item, i) => (
              <div key={i} className="rounded-md border border-border/30 bg-background/50 px-2.5 py-2 text-xs font-mono">
                {typeof item === 'object' && item !== null ? (
                  <KeyValueList data={item as Record<string, unknown>} />
                ) : (
                  String(item)
                )}
              </div>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">No command history captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Logs" icon={Logs}>
        {logs ? (
          <ArrayList
            items={logs}
            renderItem={(item, i) => (
              <div key={i} className="rounded-md border border-border/30 bg-background/50 px-2.5 py-2 text-xs font-mono whitespace-pre-wrap">
                {typeof item === 'object' && item !== null ? (
                  JSON.stringify(item, null, 2)
                ) : (
                  String(item)
                )}
              </div>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">No logs captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Environment" icon={Globe}>
        {environment ? (
          <KeyValueList data={environment} />
        ) : (
          <p className="text-xs text-muted-foreground italic">No environment snapshot captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Containers" icon={Container}>
        {containers ? (
          <ArrayList
            items={containers}
            renderItem={(item, i) => (
              <div key={i} className="rounded-md border border-border/30 bg-background/50 px-2.5 py-2 text-xs">
                {typeof item === 'object' && item !== null ? (
                  <KeyValueList data={item as Record<string, unknown>} />
                ) : (
                  String(item)
                )}
              </div>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">No container state captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Health Check" icon={Activity}>
        {health ? (
          <KeyValueList data={health} />
        ) : (
          <p className="text-xs text-muted-foreground italic">No health snapshot captured.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Project Notes" icon={FileText}>
        {notes ? (
          <KeyValueList data={notes} />
        ) : (
          <p className="text-xs text-muted-foreground italic">No notes captured.</p>
        )}
      </CollapsibleSection>
    </div>
  )
}

export function BugReportDetail({ bug, attachments, open, onOpenChange }: BugReportDetailProps) {
  const [snapshot, setSnapshot] = useState<BugContextSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setSnapshot(null)
    setSnapshotError(null)
    setSnapshotLoading(true)

    let ignore = false

    window.electronAPI.getBugContextSnapshot(bug.id)
      .then((result) => {
        if (ignore) return
        if (result.ok) {
          setSnapshot(result.data)
        } else {
          setSnapshotError(result.error.message)
        }
      })
      .catch((err) => {
        if (ignore) return
        setSnapshotError(err instanceof Error ? err.message : 'Failed to load context snapshot.')
      })
      .finally(() => {
        if (ignore) return
        setSnapshotLoading(false)
      })

    return () => { ignore = true }
  }, [open, bug.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-6">{bug.title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge
              variant={severityBadgeVariant[bug.severity]}
              className="text-[10px] uppercase tracking-wider h-5"
            >
              {severityLabels[bug.severity]}
            </Badge>
            <Badge
              variant={statusBadgeVariant[bug.status]}
              className="text-[10px] uppercase tracking-wider h-5"
            >
              {statusLabels[bug.status]}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {formatDateTime(bug.createdAt)}
            </span>
            {bug.resolvedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Resolved {formatDateTime(bug.resolvedAt)}
              </span>
            )}
          </div>
          <DialogDescription className="sr-only">
            Detailed bug report with context snapshot and attachments
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-5 py-1">
            {/* Description fields */}
            {bug.expectedResult && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Expected Result
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/30">
                  {bug.expectedResult}
                </p>
              </div>
            )}

            {bug.actualResult && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Actual Result
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/30">
                  {bug.actualResult}
                </p>
              </div>
            )}

            {bug.reproductionSteps && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Reproduction Steps
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/30">
                  {bug.reproductionSteps}
                </p>
              </div>
            )}

            {bug.notes && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Notes
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/30">
                  {bug.notes}
                </p>
              </div>
            )}

            {bug.resolutionNotes && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Resolution Notes
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/30">
                  {bug.resolutionNotes}
                </p>
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" />
                Attachments
                {attachments.length > 0 && (
                  <span className="text-muted-foreground/60">({attachments.length})</span>
                )}
              </h4>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="text-muted-foreground">
                        {attachmentKindIcon(att.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={att.fileName}>
                          {att.fileName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(att.fileSize)}
                          {att.mimeType && ` · ${att.mimeType}`}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDateTime(att.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No attachments.</p>
              )}
            </div>

            {/* Context Snapshot */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                <Box className="h-3 w-3" />
                Context Snapshot
              </h4>
              {snapshotLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-r-transparent" />
                  Loading context snapshot...
                </div>
              ) : snapshotError ? (
                <p className="text-xs text-destructive">{snapshotError}</p>
              ) : snapshot ? (
                <ContextSnapshotView snapshot={snapshot} />
              ) : (
                <p className="text-xs text-muted-foreground italic">No context snapshot attached.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
