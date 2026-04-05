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

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
            Git Snapshot
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wider">
              <GitBranch className="h-3 w-3" />
              {gitInsights?.branch ?? 'No Repo'}
            </Badge>
            <Badge
              variant={workingTree?.isClean ? 'success' : 'secondary'}
              className="text-[10px] uppercase tracking-wider"
            >
              {workingTree ? (workingTree.isClean ? 'Clean' : 'Changes Pending') : 'Unavailable'}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[11px] font-semibold"
          onClick={() => onOpenWorkspace(project.id)}
        >
          Open Git Workspace
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isLoading ? (
          <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wider">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading
          </Badge>
        ) : workingTree ? (
          <>
            <Badge variant={workingTree.stagedCount > 0 ? 'success' : 'outline'} className="text-[10px] uppercase tracking-wider">
              Staged {workingTree.stagedCount}
            </Badge>
            <Badge variant={workingTree.unstagedCount > 0 ? 'warning' : 'outline'} className="text-[10px] uppercase tracking-wider">
              Unstaged {workingTree.unstagedCount}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Untracked {workingTree.untrackedCount}
            </Badge>
            <Badge variant={workingTree.conflictedCount > 0 ? 'destructive' : 'outline'} className="text-[10px] uppercase tracking-wider">
              Conflicts {workingTree.conflictedCount}
            </Badge>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Git details will appear here when repository insights are available.
          </p>
        )}
      </div>
    </div>
  )
}
