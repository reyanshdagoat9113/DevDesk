import { Loader2 } from 'lucide-react'
import { Badge } from './ui/Badge'
import { ScrollArea } from './ui/ScrollArea'
import { cn } from '../../lib/utils'
import type { GitDiffLine, GitFileDiffResult } from '../types'

function lineNumberLabel(value?: number) {
  return typeof value === 'number' ? String(value) : ''
}

function lineClassName(kind: GitDiffLine['kind']) {
  switch (kind) {
    case 'add':
      return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
    case 'del':
      return 'bg-rose-500/10 text-rose-800 dark:text-rose-200'
    case 'hunk':
      return 'bg-sky-500/10 text-sky-800 dark:text-sky-200'
    case 'meta':
      return 'text-muted-foreground/80'
    default:
      return 'text-foreground/90'
  }
}

function linePrefix(kind: GitDiffLine['kind']) {
  switch (kind) {
    case 'add':
      return '+'
    case 'del':
      return '-'
    case 'hunk':
      return '@'
    default:
      return ' '
  }
}

export function GitDiffViewer({
  path,
  previousPath,
  diff,
  isLoading,
  error,
}: {
  path: string | null
  previousPath?: string
  diff: GitFileDiffResult | null
  isLoading: boolean
  error: string | null
}) {
  if (!path) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border/40 px-4 text-center text-sm text-muted-foreground">
        Select a changed file to inspect its diff.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center gap-2 rounded-lg border border-border/30 bg-background/70 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading diff…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!diff || !diff.ok) {
    return (
      <div className="rounded-lg border border-border/30 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
        {diff?.message || 'Unable to load diff for this file.'}
      </div>
    )
  }

  if (!diff.sections.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
        {diff.message || 'No pending changes for this file.'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-mono text-[11px] font-semibold text-foreground">{diff.path || path}</p>
          {previousPath || diff.previousPath ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              renamed from {previousPath || diff.previousPath}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {diff.sections.map((section) => (
            <Badge key={section.scope} variant="outline" className="h-5 px-2 text-[9px] uppercase tracking-wider">
              {section.label}
              {!section.binary ? ` +${section.additions}/-${section.deletions}` : ' binary'}
            </Badge>
          ))}
        </div>
      </div>

      {diff.sections.map((section) => (
        <div key={section.scope} className="overflow-hidden rounded-lg border border-border/30 bg-background/70">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.label}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {section.truncated ? <span>Truncated</span> : null}
              {!section.binary ? (
                <span className="tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">+{section.additions}</span>
                  {' / '}
                  <span className="text-rose-600 dark:text-rose-400">-{section.deletions}</span>
                </span>
              ) : null}
            </div>
          </div>

          <ScrollArea className="h-[320px]">
            <div className="min-w-full font-mono text-[11px] leading-5">
              {section.lines.map((line, index) => (
                <div
                  key={`${section.scope}-${index}`}
                  className={cn('grid grid-cols-[2.75rem_2.75rem_1.25rem_minmax(0,1fr)] gap-0 px-2', lineClassName(line.kind))}
                >
                  <span className="select-none pr-2 text-right text-[10px] text-muted-foreground/70 tabular-nums">
                    {lineNumberLabel(line.oldLineNumber)}
                  </span>
                  <span className="select-none pr-2 text-right text-[10px] text-muted-foreground/70 tabular-nums">
                    {lineNumberLabel(line.newLineNumber)}
                  </span>
                  <span className="select-none text-center opacity-70">{line.kind === 'meta' || line.kind === 'hunk' ? '' : linePrefix(line.kind)}</span>
                  <span className="whitespace-pre-wrap break-all">{line.text}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  )
}
