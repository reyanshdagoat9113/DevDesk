import { useEffect, useState } from 'react'
import { GitBranch, Loader2 } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
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

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    onLoadGitInsights(project.id)
      .then((result) => {
        if (!cancelled) {
          setGitInsights(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGitInsights(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [onLoadGitInsights, project.id])

  const workingTree = gitInsights?.workingTree ?? null

  const statItems = workingTree
    ? [
        { label: 'Staged', value: workingTree.stagedCount, tone: workingTree.stagedCount > 0 ? 'success' : 'outline' as const },
        { label: 'Unstaged', value: workingTree.unstagedCount, tone: workingTree.unstagedCount > 0 ? 'warning' : 'outline' as const },
        { label: 'Untracked', value: workingTree.untrackedCount, tone: 'outline' as const },
        { label: 'Conflicts', value: workingTree.conflictedCount, tone: workingTree.conflictedCount > 0 ? 'destructive' : 'outline' as const },
      ]
    : []

  return (
    <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Git Snapshot
            </p>
            <Badge variant={workingTree?.isClean ? 'success' : 'secondary'} className="h-5 px-2 text-[9px] uppercase tracking-wider">
              {workingTree ? (workingTree.isClean ? 'Clean' : 'Dirty') : 'Unavailable'}
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
        {isLoading ? (
          <Badge variant="outline" className="col-span-2 h-8 justify-start gap-1.5 px-2 text-[10px] uppercase tracking-wider sm:col-span-4">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading
          </Badge>
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
        ) : (
          <p className="col-span-2 text-[11px] text-muted-foreground sm:col-span-4">
            Git details will appear here when repository insights are available.
          </p>
        )}
      </div>
    </div>
  )
}
