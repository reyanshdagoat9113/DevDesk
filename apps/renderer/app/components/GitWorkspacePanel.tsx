import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Loader2,
  RefreshCcw,
  Send,
  TriangleAlert,
} from 'lucide-react'
import { GitDiffViewer } from './GitDiffViewer'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/Dialog'
import { Input } from './ui/Input'
import { ScrollArea } from './ui/ScrollArea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'
import { Textarea } from './ui/Textarea'
import { cn } from '../../lib/utils'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import type {
  EngineGitInsights,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitFileDiffResult,
  GitPushResult,
  GitWorkflowState,
  Project,
} from '../types'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

type GitFileSummary =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'
  | 'unknown'

function summaryBadgeVariant(summary: GitFileSummary | undefined) {
  switch (summary) {
    case 'added':
      return 'success'
    case 'deleted':
      return 'destructive'
    case 'conflicted':
      return 'warning'
    default:
      return 'outline'
  }
}

function buildDefaultPrTitle(branch: string | null, recentCommit?: EngineGitInsights['recentCommits'][number]) {
  if (recentCommit?.message?.trim()) {
    return recentCommit.message.trim()
  }
  if (branch?.trim()) {
    return branch.replace(/[-_/]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  return 'Update project'
}

function buildDefaultPrBody(project: Project, recentCommit?: EngineGitInsights['recentCommits'][number]) {
  const lines = [
    '## Summary',
    `- Updates for ${project.name}`,
  ]

  if (recentCommit?.message?.trim()) {
    lines.push(`- Latest commit: ${recentCommit.message.trim()}`)
  }

  lines.push('', '## Validation', '- Local verification')
  return lines.join('\n')
}

export function GitWorkspacePanel({
  project,
  onLoadGitInsights,
  onLoadGitState,
  onLoadFileDiff,
  onCommitChanges,
  onPushBranch,
  onCreatePullRequest,
  onOpenExternalUrl,
  onOpenResult,
  onRevealResult,
}: {
  project: Project
  onLoadGitInsights: (projectId: string) => Promise<EngineGitInsights>
  onLoadGitState: (projectId: string) => Promise<GitWorkflowState>
  onLoadFileDiff: (projectId: string, relativePath: string) => Promise<GitFileDiffResult>
  onCommitChanges: (projectId: string, message: string) => Promise<GitCommitResult>
  onPushBranch: (projectId: string) => Promise<GitPushResult>
  onCreatePullRequest: (
    projectId: string,
    input: { title: string; body: string; isDraft: boolean; baseBranch?: string }
  ) => Promise<GitCreatePullRequestResult>
  onOpenExternalUrl: (url: string) => Promise<void>
  onOpenResult?: (projectId: string, relativePath: string) => Promise<void>
  onRevealResult?: (projectId: string, relativePath: string) => Promise<void>
}) {
  type GitInsightView = 'overview' | 'changes' | 'activity'

  const [gitInsights, setGitInsights] = useState<EngineGitInsights | null>(null)
  const [gitState, setGitState] = useState<GitWorkflowState | null>(null)
  const [insightView, setInsightView] = useState<GitInsightView>('overview')
  const [commitMessage, setCommitMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingState, setIsLoadingState] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false)
  const [isCreatingPr, setIsCreatingPr] = useState(false)
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')
  const [prBaseBranch, setPrBaseBranch] = useState('')
  const [prMode, setPrMode] = useState<'draft' | 'ready'>('draft')
  const [prResult, setPrResult] = useState<GitCreatePullRequestResult | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedFileDiff, setSelectedFileDiff] = useState<GitFileDiffResult | null>(null)
  const [isLoadingDiff, setIsLoadingDiff] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diffReloadToken, setDiffReloadToken] = useState(0)
  const diffRequestId = useRef(0)

  const changedFiles = useMemo(() => gitState?.workingTree?.files ?? [], [gitState?.workingTree?.files])
  const recentCommits = gitInsights?.recentCommits ?? []
  const firstRecentCommit = recentCommits[0]
  const selectedFile = useMemo(
    () => changedFiles.find((file) => file.path === selectedFilePath) ?? null,
    [changedFiles, selectedFilePath]
  )

  const loadFileDiff = useCallback(async (relativePath: string) => {
    const requestId = diffRequestId.current + 1
    diffRequestId.current = requestId
    setIsLoadingDiff(true)
    setSelectedFileDiff(null)
    setDiffError(null)
    try {
      const result = await onLoadFileDiff(project.id, relativePath)
      if (requestId !== diffRequestId.current) {
        return
      }
      setSelectedFileDiff(result)
      if (!result.ok) {
        setDiffError(result.message || 'Failed to load file diff.')
      }
    } catch (loadError) {
      if (requestId !== diffRequestId.current) {
        return
      }
      setSelectedFileDiff(null)
      setDiffError(loadError instanceof Error ? loadError.message : 'Failed to load file diff.')
    } finally {
      if (requestId === diffRequestId.current) {
        setIsLoadingDiff(false)
      }
    }
  }, [onLoadFileDiff, project.id])

  const refreshGitData = useCallback(async () => {
    setIsLoadingState(true)
    setError(null)
    try {
      const [stateResult, insightsResult] = await Promise.allSettled([
        onLoadGitState(project.id),
        onLoadGitInsights(project.id),
      ])
      if (stateResult.status === 'rejected') {
        throw stateResult.reason
      }

      const nextState = stateResult.value
      setGitState(nextState)

      if (nextState.available) {
        if (insightsResult.status === 'fulfilled') {
          setGitInsights(insightsResult.value)
        } else {
          setGitInsights(null)
          setError(insightsResult.reason instanceof Error ? insightsResult.reason.message : 'Failed to load git activity.')
        }
      } else {
        setGitInsights(null)
      }
    } catch (loadError) {
      setGitState(null)
      setGitInsights(null)
      setError(loadError instanceof Error ? loadError.message : 'Failed to load git workspace.')
    } finally {
      setIsLoadingState(false)
      setDiffReloadToken((token) => token + 1)
    }
  }, [onLoadGitInsights, onLoadGitState, project.id])

  useAutoRefresh(refreshGitData)

  useEffect(() => {
    if (insightView === 'changes' && !changedFiles.length) {
      setInsightView('overview')
    }
    if (insightView === 'activity' && !recentCommits.length) {
      setInsightView('overview')
    }
  }, [changedFiles.length, insightView, recentCommits.length])

  useEffect(() => {
    if (!changedFiles.length) {
      diffRequestId.current += 1
      setSelectedFilePath(null)
      setSelectedFileDiff(null)
      setDiffError(null)
      return
    }

    if (selectedFilePath && changedFiles.some((file) => file.path === selectedFilePath)) {
      return
    }

    setSelectedFilePath(changedFiles[0]?.path ?? null)
  }, [changedFiles, selectedFilePath])

  useEffect(() => {
    if (!selectedFilePath || insightView !== 'changes') {
      return
    }
    void loadFileDiff(selectedFilePath)
  }, [diffReloadToken, insightView, loadFileDiff, selectedFilePath])

  useEffect(() => {
    setPrTitle(buildDefaultPrTitle(gitState?.branch ?? null, firstRecentCommit))
    setPrBody(buildDefaultPrBody(project, firstRecentCommit))
    setPrBaseBranch(gitState?.remoteName ? 'main' : '')
    setPrResult(null)
  }, [firstRecentCommit, gitState?.branch, gitState?.remoteName, project])

  const statusPills = useMemo(() => {
    const workingTree = gitState?.workingTree
    if (!workingTree) {
      return []
    }

    return [
      {
        label: 'Staged',
        value: workingTree.stagedCount,
        variant: workingTree.stagedCount > 0 ? 'success' : 'outline',
      },
      {
        label: 'Unstaged',
        value: workingTree.unstagedCount,
        variant: workingTree.unstagedCount > 0 ? 'warning' : 'outline',
      },
      {
        label: 'Untracked',
        value: workingTree.untrackedCount,
        variant: workingTree.untrackedCount > 0 ? 'outline' : 'outline',
      },
      {
        label: 'Conflicts',
        value: workingTree.conflictedCount,
        variant: workingTree.conflictedCount > 0 ? 'destructive' : 'outline',
      },
    ] as const
  }, [gitState?.workingTree])

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Enter a commit message to continue.')
      return
    }

    setIsCommitting(true)
    setError(null)
    setStatus(null)
    try {
      const result = await onCommitChanges(project.id, commitMessage)
      if (!result.ok) {
        setError(result.message)
        return
      }

      setCommitMessage('')
      setStatus(result.message)
      await refreshGitData()
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Failed to commit changes.')
    } finally {
      setIsCommitting(false)
    }
  }

  const handlePush = async () => {
    setIsPushing(true)
    setError(null)
    setStatus(null)
    try {
      const result = await onPushBranch(project.id)
      if (!result.ok) {
        setError(result.message)
        return
      }

      setStatus(result.message)
      await refreshGitData()
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Failed to push the current branch.')
    } finally {
      setIsPushing(false)
    }
  }

  const handleCreatePr = async () => {
    if (!prTitle.trim()) {
      setError('A pull request title is required.')
      return
    }

    setIsCreatingPr(true)
    setError(null)
    try {
      const result = await onCreatePullRequest(project.id, {
        title: prTitle.trim(),
        body: prBody.trim(),
        isDraft: prMode === 'draft',
        baseBranch: prBaseBranch.trim() || undefined,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setPrResult(result)
      setStatus(result.message)
      setIsPrDialogOpen(false)
    } catch (prError) {
      setError(prError instanceof Error ? prError.message : 'Failed to open pull request flow.')
    } finally {
      setIsCreatingPr(false)
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Git Workspace
            </h3>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Daily repo flow for {project.name}: review changes, commit, push, and file a pull request.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={insightView} onValueChange={(value) => setInsightView(value as GitInsightView)}>
              <SelectTrigger className="h-8 w-[145px] text-[11px]">
                <SelectValue placeholder="Insights" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="changes" disabled={!changedFiles.length}>
                  Changes
                </SelectItem>
                <SelectItem value="activity" disabled={!recentCommits.length}>
                  Activity
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-2 px-3 text-[11px] font-semibold"
              onClick={() => void refreshGitData()}
              disabled={isLoadingState}
            >
              {isLoadingState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {!gitState?.available ? (
          <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Git workspace unavailable</p>
              <p>{gitState?.message || 'This project does not appear to be a git repository.'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 rounded-lg border border-border/40 bg-card p-5">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md bg-muted/25 px-3 py-2.5 sm:col-span-2 lg:col-span-1">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Branch</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{gitState.branch || 'Detached'}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/25 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">State</p>
                  <p className="mt-1 text-sm font-semibold">{gitState.workingTree?.isClean ? 'Clean' : 'Changes pending'}</p>
                </div>
                <div className="rounded-md bg-muted/25 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Ahead</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{gitState.ahead}</p>
                </div>
                <div className="rounded-md bg-muted/25 px-3 py-2.5">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Behind</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{gitState.behind}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  {gitState.remoteName ? (
                    <>
                      Remote <span className="font-semibold text-foreground">{gitState.remoteName}</span>
                      {gitState.upstream ? ` / ${gitState.upstream}` : ''}
                    </>
                  ) : (
                    'No remote configured yet.'
                  )}
                </span>
                {firstRecentCommit ? (
                  <span className="truncate">
                    · Latest <span className="font-semibold text-foreground">{firstRecentCommit.message}</span>
                  </span>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {statusPills.map((pill) => (
                    <Badge key={pill.label} variant={pill.variant} className="h-5 px-2 text-[9px] uppercase tracking-wider">
                      {pill.label} {pill.value}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className={insightView === 'changes' ? 'space-y-3' : 'hidden'}>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Changed Files
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a file to inspect its diff, open it in the editor, or reveal it in the folder.
                </p>
              </div>
              <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.35fr)]">
                <ScrollArea className="h-[420px] rounded-md border border-border/30 bg-muted/15">
                  <div className="space-y-1 p-2">
                    {changedFiles.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
                        No pending file changes.
                      </div>
                    ) : (
                      changedFiles.map((file) => {
                        const isSelected = file.path === selectedFilePath
                        return (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => {
                              if (file.path !== selectedFilePath) {
                                diffRequestId.current += 1
                                setSelectedFilePath(file.path)
                                setSelectedFileDiff(null)
                                setDiffError(null)
                                setIsLoadingDiff(true)
                              }
                              setInsightView('changes')
                            }}
                            className={cn(
                              'w-full rounded-md px-3 py-2.5 text-left transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-foreground ring-1 ring-primary/15'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={summaryBadgeVariant(file.summary)}
                                    className="h-5 px-2 text-[9px] uppercase tracking-wider"
                                  >
                                    {file.summary}
                                  </Badge>
                                  {file.conflicted ? (
                                    <Badge variant="destructive" className="h-5 px-2 text-[9px] uppercase tracking-wider">
                                      Conflict
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="truncate font-mono text-[10.5px] font-semibold text-foreground">
                                  {file.path}
                                </p>
                              </div>
                              <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                                <div className="tabular-nums">+{file.additions} / -{file.deletions}</div>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {onOpenResult ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onOpenResult(project.id, file.path)
                                  }}
                                >
                                  Open
                                </Button>
                              ) : null}
                              {onRevealResult ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void onRevealResult(project.id, file.path)
                                  }}
                                >
                                  Reveal
                                </Button>
                              ) : null}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="min-w-0">
                  <GitDiffViewer
                    path={selectedFilePath}
                    previousPath={selectedFile?.previousPath}
                    diff={selectedFileDiff}
                    isLoading={isLoadingDiff}
                    error={diffError}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <LabelLine label="Commit Message" meta={gitState.branch ? `Branch ${gitState.branch}` : undefined} />
                  <Textarea
                    value={commitMessage}
                    onChange={(event) => setCommitMessage(event.target.value)}
                    placeholder="Describe the change set clearly..."
                    rows={2}
                    className="min-h-[76px] bg-background"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-8 gap-2 px-3 text-[11px] font-semibold"
                    onClick={() => void handleCommit()}
                    disabled={isCommitting || !commitMessage.trim() || Boolean(gitState.workingTree?.hasConflicts)}
                  >
                    {isCommitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommitHorizontal className="h-3.5 w-3.5" />}
                    {isCommitting ? 'Committing...' : 'Commit All'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 px-3 text-[11px] font-semibold"
                    onClick={() => void handlePush()}
                    disabled={isPushing || !gitState.canPush}
                  >
                    {isPushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {isPushing ? 'Pushing...' : 'Push Branch'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 px-3 text-[11px] font-semibold"
                    onClick={() => setIsPrDialogOpen(true)}
                    disabled={!gitState.canCreatePullRequest}
                  >
                    <Github className="h-3.5 w-3.5" />
                    Create PR
                  </Button>
                </div>

                {status ? (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                    {status}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                    {error}
                  </div>
                ) : null}
                {prResult?.ok && prResult.url ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px]">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">Pull request link ready</p>
                      <p className="break-all text-muted-foreground">{prResult.url}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 text-[11px] font-semibold"
                      onClick={() => void onOpenExternalUrl(prResult.url!)}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open PR
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className={insightView === 'activity' ? 'space-y-2.5 xl:col-span-2' : 'space-y-2.5'}>
                <LabelLine label="Recent Activity" meta={`${recentCommits.length} commits`} />
                <div className="space-y-1.5">
                  {recentCommits.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/40 px-4 py-5 text-sm text-muted-foreground">
                      Commit history will appear here once git activity is available.
                    </div>
                  ) : (
                    recentCommits.slice(0, 4).map((commit) => (
                      <div key={commit.hash} className="rounded-md bg-muted/25 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold leading-5">{commit.message}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {commit.author} · {formatDate(commit.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[9px] uppercase tracking-wider">
                            {commit.hash.slice(0, 7)}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isPrDialogOpen} onOpenChange={setIsPrDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create pull request</DialogTitle>
            <DialogDescription>
              Prepare a GitHub pull request for {project.name}. The current flow opens the GitHub compare page in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPrMode('draft')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  prMode === 'draft' ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/40 text-muted-foreground hover:bg-muted/40'
                )}
              >
                Draft PR
              </button>
              <button
                type="button"
                onClick={() => setPrMode('ready')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  prMode === 'ready' ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/40 text-muted-foreground hover:bg-muted/40'
                )}
              >
                Ready for review
              </button>
            </div>
            <Input value={prTitle} onChange={(event) => setPrTitle(event.target.value)} placeholder="Pull request title" />
            <Input value={prBaseBranch} onChange={(event) => setPrBaseBranch(event.target.value)} placeholder="Base branch (defaults to main)" />
            <Textarea value={prBody} onChange={(event) => setPrBody(event.target.value)} rows={8} placeholder="Describe the changes and validation." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrDialogOpen(false)} disabled={isCreatingPr}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePr()} disabled={isCreatingPr || !prTitle.trim()}>
              {isCreatingPr ? 'Opening...' : 'Open PR Flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LabelLine({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
    </div>
  )
}
