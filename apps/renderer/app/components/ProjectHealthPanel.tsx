import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, Play, RefreshCw, X } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import type { Command, CreateCommandInput, HealthSuggestion, Project, ProjectHealthReport } from '../types'

function formatAnalyzedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function getSuggestionIcon(type: HealthSuggestion['type']) {
  if (type === 'warning') return AlertTriangle
  if (type === 'success') return CheckCircle2
  return Info
}

function getSuggestionTone(type: HealthSuggestion['type']) {
  if (type === 'warning') return 'text-amber-500'
  if (type === 'success') return 'text-emerald-500'
  return 'text-blue-500'
}

function getStatusBadge(report: ProjectHealthReport | null) {
  if (!report) {
    return { label: 'Not inspected', variant: 'outline' as const }
  }
  if (report.status === 'critical') {
    return { label: 'Critical', variant: 'destructive' as const }
  }
  if (report.status === 'warning') {
    return { label: 'Warning', variant: 'warning' as const }
  }
  return { label: 'Healthy', variant: 'success' as const }
}

export function ProjectHealthPanel({
  project,
  onCreateCommand,
  onRunCommand,
  onReportLoaded,
}: {
  project: Project
  onCreateCommand?: (command: CreateCommandInput) => Promise<Command>
  onRunCommand?: (commandId: string, projectId: string) => Promise<unknown>
  onReportLoaded?: (report: ProjectHealthReport) => void
}) {
  const [report, setReport] = useState<ProjectHealthReport | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [runningSuggestionId, setRunningSuggestionId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visibleSuggestions = useMemo(() => {
    return report?.suggestions.filter((suggestion) => !dismissedIds.has(suggestion.id)) ?? []
  }, [dismissedIds, report])

  const statusBadge = getStatusBadge(report)

  const loadHealth = async () => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    try {
      const nextReport = await window.electronAPI.inspectProject(project.id)
      setReport(nextReport)
      onReportLoaded?.(nextReport)
      setDismissedIds(new Set())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to inspect project.')
      setReport(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadHealth()
  }, [project.id])

  const handleDismiss = (suggestionId: string) => {
    setDismissedIds((current) => {
      const next = new Set(current)
      next.add(suggestionId)
      return next
    })
  }

  const handleRunSuggestion = async (suggestion: HealthSuggestion) => {
    const command = suggestion.action?.command?.trim()
    if (!command || !onCreateCommand || !onRunCommand || runningSuggestionId) {
      return
    }

    setRunningSuggestionId(suggestion.id)
    setError(null)
    setMessage(null)
    try {
      const created = await onCreateCommand({
        name: suggestion.action?.label ?? suggestion.message,
        command,
        description: `Suggested by Project Intelligence for ${project.name}.`,
        tags: ['project-intelligence'],
        projectId: project.id,
      })
      await onRunCommand(created.id, project.id)
      setMessage(`Started "${created.name}".`)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run suggested action.')
    } finally {
      setRunningSuggestionId(null)
    }
  }

  return (
    <section className="rounded-xl border border-border/40 bg-background/50 px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Project Intelligence
            </p>
            <Badge variant={statusBadge.variant} className="h-5 px-2 text-[9px] uppercase tracking-wider">
              {statusBadge.label}
            </Badge>
          </div>
          <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
            {report
              ? `Last analyzed ${formatAnalyzedAt(report.analyzedAt)}. ${report.packageManager ? `Detected ${report.packageManager}.` : 'No package manager detected.'}`
              : 'Inspect project setup and surface useful next actions.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-3 text-[11px] font-semibold"
          onClick={() => void loadHealth()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-600">
          {message}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {isLoading && !report ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/5 px-3 py-3 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Inspecting project
          </div>
        ) : visibleSuggestions.length > 0 ? (
          visibleSuggestions.map((suggestion) => {
            const Icon = getSuggestionIcon(suggestion.type)
            const command = suggestion.action?.command
            const canRun = Boolean(command && onCreateCommand && onRunCommand)

            return (
              <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/5 px-3 py-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${getSuggestionTone(suggestion.type)}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{suggestion.message}</p>
                    {command ? (
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{command}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {suggestion.action ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-2.5 text-[10px] font-semibold"
                      onClick={() => void handleRunSuggestion(suggestion)}
                      disabled={!canRun || runningSuggestionId !== null}
                      title={canRun ? suggestion.action.label : 'Command execution is unavailable'}
                    >
                      {runningSuggestionId === suggestion.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      {runningSuggestionId === suggestion.id ? 'Starting' : suggestion.action.label}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDismiss(suggestion.id)}
                    title="Dismiss suggestion"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-border/30 bg-muted/5 px-3 py-3 text-[11px] text-muted-foreground">
            No active suggestions. Refresh to inspect again.
          </div>
        )}
      </div>
    </section>
  )
}
