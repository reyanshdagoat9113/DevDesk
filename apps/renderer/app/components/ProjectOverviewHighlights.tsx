import { useEffect, useState } from 'react'
import { FileText, GitBranch, Loader2 } from 'lucide-react'
import { Badge } from './ui/Badge'
import type { EngineGitInsights, ProjectNotes } from '../types'

interface ProjectOverviewHighlightsProps {
  projectId: string
  onLoadGitInsights?: (projectId: string) => Promise<EngineGitInsights>
}

function notePreview(value: string) {
  const text = value.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 177)}\u2026` : text
}

export function ProjectOverviewHighlights({ projectId, onLoadGitInsights }: ProjectOverviewHighlightsProps) {
  const [notes, setNotes] = useState<ProjectNotes | null>(null)
  const [git, setGit] = useState<EngineGitInsights | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.electronAPI.getProjectNotes(projectId).then((result) => {
      if (!cancelled) setNotes(result)
    }).catch(() => {
      if (!cancelled) setNotes(null)
    })
    if (onLoadGitInsights) {
      void onLoadGitInsights(projectId).then((result) => {
        if (!cancelled) setGit(result)
      }).catch(() => {
        if (!cancelled) setGit(null)
      })
    }
    return () => { cancelled = true }
  }, [onLoadGitInsights, projectId])

  const noteItems = notes
    ? [
        ['Setup', notes.setupSteps],
        ['Todos', notes.todos],
        ['Reminders', notes.reminders],
      ].filter(([, value]) => Boolean(value.trim()))
    : []
  const workingTree = git?.workingTree ?? null
  const hasGitInsight = Boolean(workingTree && (!workingTree.isClean || workingTree.ahead > 0 || workingTree.behind > 0))

  if (noteItems.length === 0 && !hasGitInsight) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {noteItems.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Project Notes</h3>
          </div>
          <div className="space-y-3">
            {noteItems.map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
                <p className="text-xs leading-relaxed text-foreground/85">{notePreview(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasGitInsight && workingTree && (
        <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Git Insights</h3>
            {!git && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-6 gap-1.5 px-2 text-[10px] uppercase tracking-wider">
              <GitBranch className="h-3 w-3" /> {git?.branch ?? 'Current branch'}
            </Badge>
            {!workingTree.isClean && <Badge variant="warning">Working tree changes</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Staged', workingTree.stagedCount], ['Unstaged', workingTree.unstagedCount], ['Untracked', workingTree.untrackedCount], ['Conflicts', workingTree.conflictedCount]].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/30 bg-background/70 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {(workingTree.ahead > 0 || workingTree.behind > 0) && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {workingTree.ahead > 0 ? `${workingTree.ahead} ahead` : 'Up to date'} \u00b7 {workingTree.behind > 0 ? `${workingTree.behind} behind` : 'not behind'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
