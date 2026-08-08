import { useEffect, useMemo, useState } from 'react'
import { FolderGit2, RefreshCcw, Search } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/Card'
import { ProjectEnginePanel } from '../components/ProjectEnginePanel'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type {
  EngineGitInsights,
  EngineIndexResult,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitFileDiffResult,
  GitPushResult,
  GitWorkflowState,
  Project,
} from '../types'

export function EngineSection({
  projects,
  engineStatus,
  engineIndexes,
  searchSessions,
  indexingProjects,
  latestIndexResults,
  selectedProjectId,
  onSelectProject,
  isLoading,
  error,
  onRefreshStatus,
  onIndexProject,
  onSearch,
  onLoadStats,
  onLoadGitInsights,
  onLoadGitState,
  onLoadFileDiff,
  onCommitChanges,
  onPushBranch,
  onCreatePullRequest,
  onOpenResult,
  onRevealResult,
  onClearIndex,
  onClearSearchSession,
  onOpenExternalUrl,
}: {
  projects: Project[]
  engineStatus: EngineStatus | null
  engineIndexes: Record<string, EngineIndexMeta>
  searchSessions: Record<string, EngineSearchSession>
  indexingProjects: Record<string, boolean>
  latestIndexResults: Record<string, EngineIndexResult>
  selectedProjectId?: string | null
  onSelectProject?: (projectId: string) => void
  isLoading?: boolean
  error?: string | null
  onRefreshStatus?: () => Promise<void>
  onIndexProject?: (projectId: string) => Promise<unknown>
  onSearch?: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadStats?: (projectId: string) => Promise<EngineStats>
  onLoadGitInsights?: (projectId: string) => Promise<EngineGitInsights>
  onLoadGitState?: (projectId: string) => Promise<GitWorkflowState>
  onLoadFileDiff?: (projectId: string, relativePath: string) => Promise<GitFileDiffResult>
  onCommitChanges?: (projectId: string, message: string) => Promise<GitCommitResult>
  onPushBranch?: (projectId: string) => Promise<GitPushResult>
  onCreatePullRequest?: (
    projectId: string,
    input: { title: string; body: string; isDraft: boolean; baseBranch?: string }
  ) => Promise<GitCreatePullRequestResult>
  onOpenResult?: (projectId: string, relativePath: string, location?: { line?: number; column?: number }) => Promise<void>
  onRevealResult?: (projectId: string, relativePath: string) => Promise<void>
  onClearIndex?: (projectId: string) => Promise<void>
  onClearSearchSession?: (projectId: string) => Promise<void>
  onOpenExternalUrl?: (url: string) => Promise<void>
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const isControlled = selectedProjectId !== undefined
  const effectiveSelectedId = isControlled ? selectedProjectId : internalSelectedId

  useEffect(() => {
    if (!projects.length) {
      if (!isControlled) {
        setInternalSelectedId(null)
      }
      return
    }
    if (!effectiveSelectedId || !projects.some((project) => project.id === effectiveSelectedId)) {
      if (!isControlled) {
        setInternalSelectedId(projects[0].id)
      } else {
        onSelectProject?.(projects[0].id)
      }
    }
  }, [effectiveSelectedId, isControlled, onSelectProject, projects])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === effectiveSelectedId) ?? projects[0]
  }, [effectiveSelectedId, projects])

  const handleProjectSelect = (projectId: string) => {
    if (!isControlled) {
      setInternalSelectedId(projectId)
    }
    onSelectProject?.(projectId)
  }

  return (
    <SectionLayout
      list={
        <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <div className="border-b border-border/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Projects</p>
              <span className="text-xs text-muted-foreground tabular-nums">{projects.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-2 py-2">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">
                Loading projects...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-destructive/10 bg-destructive/5 p-4 text-center text-sm text-destructive">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                <FolderGit2 className="mb-2 h-10 w-10 opacity-20" />
                <p className="text-sm">No projects added yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => {
                  const isActive = selectedProject?.id === project.id
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleProjectSelect(project.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150',
                        isActive
                          ? 'border border-primary/15 bg-primary/10 text-foreground'
                          : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors',
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground group-hover:text-foreground'
                        )}
                      >
                        {project.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{project.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{project.path}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          variant={engineIndexes[project.id] ? 'success' : 'outline'}
                          className={cn(
                            'h-4 px-1.5 text-[8px] font-bold uppercase tracking-wider',
                            !engineIndexes[project.id] && 'border-border/40 bg-transparent text-muted-foreground/70'
                          )}
                        >
                          {engineIndexes[project.id] ? 'Indexed' : 'Pending'}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      }
      detail={
        selectedProject ? (
          <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
            <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="truncate text-2xl font-bold tracking-tight">{selectedProject.name}</CardTitle>
                    <Badge
                      variant={engineStatus?.available ? 'success' : 'outline'}
                      className="h-5 text-[10px] font-bold uppercase tracking-widest"
                    >
                      {engineStatus?.available ? 'Engine Ready' : 'Engine Offline'}
                    </Badge>
                    <Badge
                      variant={engineIndexes[selectedProject.id] ? 'secondary' : 'outline'}
                      className="h-5 text-[10px] font-bold uppercase tracking-widest"
                    >
                      {engineIndexes[selectedProject.id] ? 'Indexed' : 'Not Indexed'}
                    </Badge>
                  </div>
                  <CardDescription className="w-fit max-w-full truncate rounded border border-border/20 bg-muted/20 px-2 py-0.5 font-mono text-[11px]">
                    {selectedProject.path}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {onRefreshStatus ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-[11px] font-semibold"
                      onClick={() => void onRefreshStatus()}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Refresh Status
                    </Button>
                  ) : null}
                  <div className="rounded-full border border-border/40 bg-background/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Engine
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-6 pt-5">
              {onIndexProject &&
              onSearch &&
              onLoadStats &&
              onLoadGitInsights &&
              onLoadGitState &&
              onLoadFileDiff &&
              onCommitChanges &&
              onPushBranch &&
              onCreatePullRequest &&
              onOpenResult &&
              onRevealResult &&
              onClearIndex &&
              onClearSearchSession &&
              onOpenExternalUrl ? (
                <ProjectEnginePanel
                  project={selectedProject}
                  engineStatus={engineStatus}
                  engineIndexes={engineIndexes}
                  searchSessions={searchSessions}
                  indexingProjects={indexingProjects}
                  latestIndexResults={latestIndexResults}
                  onIndexProject={onIndexProject}
                  onSearch={onSearch}
                  onLoadStats={onLoadStats}
                  onLoadGitInsights={onLoadGitInsights}
                  onLoadGitState={onLoadGitState}
                  onLoadFileDiff={onLoadFileDiff}
                  onCommitChanges={onCommitChanges}
                  onPushBranch={onPushBranch}
                  onCreatePullRequest={onCreatePullRequest}
                  onOpenResult={onOpenResult}
                  onRevealResult={onRevealResult}
                  onClearProjectIndex={onClearIndex}
                  onClearSearchSession={onClearSearchSession}
                  onOpenExternalUrl={onOpenExternalUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-12 text-center">
                  <div className="max-w-[240px] space-y-4 opacity-40">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border/40 bg-muted/20">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold uppercase tracking-widest">Engine Workspace</h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Engine actions are unavailable until all engine handlers are wired for this view.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-0 bg-transparent p-12 text-center shadow-none">
            <div className="max-w-[240px] space-y-4 opacity-40">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border/40 bg-muted/20">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-widest">Engine Workspace</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Select a project from the explorer list to work with indexing, search, and git insights.
                </p>
              </div>
            </div>
          </Card>
        )
      }
    />
  )
}
