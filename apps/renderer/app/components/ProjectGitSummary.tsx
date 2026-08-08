import { useCallback, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ErrorState } from './ui/ErrorState'
import { LoadingState } from './ui/LoadingState'
import { StatusNotice } from './ui/StatusNotice'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import type { EngineGitInsights, Project } from '../types'

export function ProjectGitSummary({
  project,
  onLoadGitInsights,
  onOpenWorkspace,
}: {
  project: Project
  onLoadGitInsights: (projectId: string) => Promise<EngineGitInsights>
  onOpenWorkspace: (projectId: string) => void
}) {
  const [gitInsights, setGitInsights] = useState<EngineGitInsights | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadInsights = useCallback(() => {
    setIsLoading(true)
    setLoadError(null)
    return onLoadGitInsights(project.id)
      .then((result) => {
        setGitInsights(result)
      })
      .catch((error: unknown) => {
        setGitInsights(null)
        setLoadError(error instanceof Error ? error.message : 'Git insights could not be loaded.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [onLoadGitInsights, project.id])

  useAutoRefresh(loadInsights)

  const unavailableReason = loadError?.toLowerCase().includes('not a git repository') || loadError?.toLowerCase().includes('no repository') || loadError?.toLowerCase().includes('no repo')
    ? 'No Git repository was found at this project path. Initialize Git or open the project folder to inspect it.'
    : loadError?.toLowerCase().includes('git') && (loadError.toLowerCase().includes('not found') || loadError.toLowerCase().includes('enoent'))
      ? 'The Git executable is unavailable on this machine. Install Git or add it to PATH, then retry.'
      : loadError

  const workingTree = gitInsights?.workingTree ?? null

  const statItems = workingTree
    ? [
        {
          label: 'Staged',
          value: workingTree.stagedCount,
          tone: (workingTree.stagedCount > 0 ? 'success' : 'outline') as 'success' | 'outline',
        },
        {
          label: 'Unstaged',
          value: workingTree.unstagedCount,
          tone: (workingTree.unstagedCount > 0 ? 'warning' : 'outline') as 'warning' | 'outline',
        },
        { label: 'Untracked', value: workingTree.untrackedCount, tone: 'outline' as const },
        {
          label: 'Conflicts',
          value: workingTree.conflictedCount,
          tone: (workingTree.conflictedCount > 0 ? 'destructive' : 'outline') as 'destructive' | 'outline',
        },
      ]
    : []

  return (
    <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Git Snapshot
            </p>
            <Badge variant={workingTree?.isClean ? 'success' : loadError ? 'warning' : 'secondary'} className="h-5 px-2 text-[9px] uppercase tracking-wider">
              {workingTree ? (workingTree.isClean ? 'Clean' : 'Dirty') : loadError ? 'Unavailable' : 'Loading'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <Badge variant="outline" className="h-6 gap-1.5 px-2 text-[10px] uppercase tracking-wider">
              <GitBranch className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{gitInsights?.branch ?? 'No repo'}</span>
            </Badge>
            {workingTree ? (
              <span className="text-muted-foreground">
                {workingTree.ahead > 0 ? `+${workingTree.ahead}` : '0'} ahead
                {' · '}
                {workingTree.behind > 0 ? `+${workingTree.behind}` : '0'} behind
              </span>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-3 text-[11px] font-semibold"
          onClick={() => onOpenWorkspace(project.id)}
        >
          Open
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {isLoading && !workingTree ? (
          <LoadingState label="Loading Git insights" className="col-span-2 py-2 sm:col-span-4" />
        ) : workingTree ? (
          statItems.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">{item.label}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                <Badge variant={item.tone} className="h-5 px-2 text-[9px] uppercase tracking-wider">
                  {item.value > 0 ? 'Active' : 'Idle'}
                </Badge>
              </div>
            </div>
          ))
        ) : loadError ? (
          <StatusNotice
            tone={unavailableReason === loadError ? 'error' : 'warning'}
            title={unavailableReason === loadError ? 'Git insights failed' : 'Git is unavailable for this project'}
            action={<Button size="sm" variant="outline" onClick={() => void loadInsights()}>Retry</Button>}
            className="col-span-2 sm:col-span-4"
          >
            {unavailableReason}
          </StatusNotice>
        ) : (
          <ErrorState title="Git insights unavailable" description="No repository details were returned." onRetry={() => void loadInsights()} className="col-span-2 py-2 sm:col-span-4" />
        )}
      </div>
    </div>
  )
}
