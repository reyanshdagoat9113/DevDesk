import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Code2, Pencil, Terminal, Trash2, FolderGit2, Monitor, Link2, RefreshCw, Activity, Trash, Star } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { ScrollArea } from '../components/ui/ScrollArea'
import { ProjectEnginePanel } from '../components/ProjectEnginePanel'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type {
  AppPreferences,
  Container,
  EngineGitInsights,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  Project,
} from '../types'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function isWslPath(projectPath: string) {
  return /^\\\\wsl(?:\.localhost|\$)\\/i.test(projectPath)
}

const macEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'intellij', label: 'IntelliJ IDEA' },
  { id: 'sublime', label: 'Sublime Text' },
  { id: 'xcode', label: 'Xcode' },
  { id: 'custom', label: 'Custom command' },
]

const windowsEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'visual-studio', label: 'Visual Studio' },
  { id: 'custom', label: 'Custom command' },
]

const macTerminalOptions = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'iterm', label: 'iTerm' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: 'warp', label: 'Warp' },
  { id: 'hyper', label: 'Hyper' },
  { id: 'custom', label: 'Custom command' },
]

const windowsTerminalOptions = [
  { id: 'windows-terminal', label: 'Windows Terminal' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'cmd', label: 'Command Prompt' },
  { id: 'custom', label: 'Custom command' },
]

const linuxEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'custom', label: 'Custom command' },
]

const linuxTerminalOptions = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'custom', label: 'Custom command' },
]

const containerStateBadge: Record<Container['state'], 'success' | 'warning' | 'outline'> = {
  running: 'success',
  paused: 'warning',
  stopped: 'outline',
}

export function ProjectsSection({
  projects,
  containers,
  isLoading,
  error,
  containersLoading,
  containersError,
  preferences,
  engineStatus,
  engineIndexes,
  engineSearchSessions,
  onSavePreferences,
  onUpdateProject,
  onSetLinkedContainers,
  onStartDevStack,
  onStopDevStack,
  onRefreshContainers,
  onRemoveProject,
  onToggleProjectPin,
  onSelectProject,
  onIndexProject,
  onSearchProjectContent,
  onLoadEngineStats,
  onLoadEngineGitInsights,
  onOpenEngineResult,
  onRevealEngineResult,
  onClearProjectIndex,
  onClearProjectSearchSession,
  onOpenProjectEngine,
}: {
  projects: Project[]
  containers: Container[]
  isLoading?: boolean
  error?: string | null
  containersLoading?: boolean
  containersError?: string | null
  preferences?: AppPreferences | null
  engineStatus?: EngineStatus | null
  engineIndexes?: Record<string, EngineIndexMeta>
  engineSearchSessions?: Record<string, EngineSearchSession>
  onSavePreferences?: (next: AppPreferences) => Promise<void>
  onUpdateProject?: (projectId: string, updates: { name: string }) => Promise<void>
  onSetLinkedContainers?: (projectId: string, linkedContainerNames: string[]) => Promise<Project>
  onStartDevStack?: (projectId: string) => Promise<{ success: boolean; started: string[]; resumed: string[]; alreadyRunning: string[]; missing: string[] }>
  onStopDevStack?: (projectId: string) => Promise<{ success: boolean; stopped: string[]; alreadyStopped: string[]; missing: string[] }>
  onRefreshContainers?: () => Promise<void>
  onRemoveProject?: (projectId: string) => Promise<void>
  onToggleProjectPin?: (projectId: string) => Promise<void>
  onSelectProject?: (projectId: string) => void
  onIndexProject?: (projectId: string) => Promise<unknown>
  onSearchProjectContent?: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  onLoadEngineStats?: (projectId: string) => Promise<EngineStats>
  onLoadEngineGitInsights?: (projectId: string) => Promise<EngineGitInsights>
  onOpenEngineResult?: (projectId: string, relativePath: string, location?: { line?: number; column?: number }) => Promise<void>
  onRevealEngineResult?: (projectId: string, relativePath: string) => Promise<void>
  onClearProjectIndex?: (projectId: string) => Promise<void>
  onClearProjectSearchSession?: (projectId: string) => Promise<void>
  onOpenProjectEngine?: (projectId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'folder' | 'editor' | 'terminal' | null>(null)
  const [prefsDraft, setPrefsDraft] = useState<AppPreferences | null>(preferences ?? null)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [linkedContainerToAdd, setLinkedContainerToAdd] = useState('')
  const [linkingError, setLinkingError] = useState<string | null>(null)
  const [stackActionLoading, setStackActionLoading] = useState<'start' | 'stop' | null>(null)
  const [stackActionError, setStackActionError] = useState<string | null>(null)
  const [stackActionMessage, setStackActionMessage] = useState<string | null>(null)
  const [stopStackDialogOpen, setStopStackDialogOpen] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [liveLogsTarget, setLiveLogsTarget] = useState<string | null>(null)
  const [liveLogsText, setLiveLogsText] = useState('')
  const [liveLogsError, setLiveLogsError] = useState<string | null>(null)
  const [liveLogsConnecting, setLiveLogsConnecting] = useState(false)
  const [liveLogsClosed, setLiveLogsClosed] = useState(false)
  const liveLogsSubscriptionIdRef = useRef<string | null>(null)

  // Sort projects: pinned first, then by name
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // Pinned projects come first
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // If both have same pin status, sort by pinnedAt (most recent first) if pinned
      if (a.isPinned && b.isPinned) {
        const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
        const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
        return bTime - aTime
      }
      // Otherwise sort by name
      return a.name.localeCompare(b.name)
    })
  }, [projects])

  const [pinnedProjects, unpinnedProjects] = useMemo(() => {
    const pinned = sortedProjects.filter((project) => project.isPinned)
    const unpinned = sortedProjects.filter((project) => !project.isPinned)
    return [pinned, unpinned]
  }, [sortedProjects])

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !projects.some((project) => project.id === selectedId)) {
      setSelectedId(projects[0].id)
    }
  }, [projects, selectedId])

  useEffect(() => {
    setActionError(null)
    setActionLoading(null)
  }, [selectedId])

  useEffect(() => {
    setPrefsDraft(preferences ?? null)
  }, [preferences])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedId) ?? projects[0]
  }, [projects, selectedId])

  useEffect(() => {
    if (!selectedProject?.id) {
      return
    }

    onSelectProject?.(selectedProject.id)
  }, [onSelectProject, selectedProject?.id])

  useEffect(() => {
    setEditName(selectedProject?.name ?? '')
  }, [selectedProject?.id, selectedProject?.name])

  const linkedContainerNames = useMemo(
    () => selectedProject?.linkedContainerNames ?? [],
    [selectedProject?.linkedContainerNames]
  )

  const containersByName = useMemo(() => {
    const map = new Map<string, Container>()
    for (const container of containers) {
      map.set(container.name.trim().toLowerCase(), container)
    }
    return map
  }, [containers])

  const linkedContainers = useMemo(
    () =>
      linkedContainerNames.map((name) => ({
        linkedName: name,
        container: containersByName.get(name.trim().toLowerCase()) ?? null,
      })),
    [containersByName, linkedContainerNames]
  )

  const linkableContainers = useMemo(() => {
    const linked = new Set(linkedContainerNames.map((name) => name.trim().toLowerCase()))
    return containers.filter((container) => !linked.has(container.name.trim().toLowerCase()))
  }, [containers, linkedContainerNames])

  useEffect(() => {
    setLinkedContainerToAdd((current) => {
      if (!current) {
        return linkableContainers[0]?.name ?? ''
      }
      return linkableContainers.some((container) => container.name === current)
        ? current
        : linkableContainers[0]?.name ?? ''
    })
  }, [linkableContainers])

  useEffect(() => {
    setLinkingError(null)
    setStackActionError(null)
    setStackActionMessage(null)
  }, [selectedProject?.id])

  const unsubscribeLiveLogs = useCallback(async () => {
    const subscriptionId = liveLogsSubscriptionIdRef.current
    if (!subscriptionId) {
      return
    }
    liveLogsSubscriptionIdRef.current = null
    try {
      await window.electronAPI.unsubscribeContainerLogs(subscriptionId)
    } catch {
      // Best-effort cleanup
    }
  }, [])

  useEffect(() => {
    const unsubscribeData = window.electronAPI.onContainerLogsData(({ subscriptionId, chunk }) => {
      if (subscriptionId !== liveLogsSubscriptionIdRef.current) {
        return
      }
      setLiveLogsText((prev) => `${prev}${chunk}`)
    })

    const unsubscribeEnd = window.electronAPI.onContainerLogsEnd(({ subscriptionId }) => {
      if (subscriptionId !== liveLogsSubscriptionIdRef.current) {
        return
      }
      setLiveLogsClosed(true)
      void unsubscribeLiveLogs()
    })

    const unsubscribeError = window.electronAPI.onContainerLogsError(({ subscriptionId, error }) => {
      if (subscriptionId !== liveLogsSubscriptionIdRef.current) {
        return
      }
      setLiveLogsError(error || 'Live log stream failed.')
      void unsubscribeLiveLogs()
    })

    return () => {
      unsubscribeData()
      unsubscribeEnd()
      unsubscribeError()
    }
  }, [unsubscribeLiveLogs])

  useEffect(() => {
    if (logsDialogOpen) {
      return
    }
    setLiveLogsTarget(null)
    setLiveLogsText('')
    setLiveLogsError(null)
    setLiveLogsConnecting(false)
    setLiveLogsClosed(false)
    void unsubscribeLiveLogs()
  }, [logsDialogOpen, unsubscribeLiveLogs])

  useEffect(() => {
    return () => {
      void unsubscribeLiveLogs()
    }
  }, [unsubscribeLiveLogs])

  const persistLinkedContainers = useCallback(
    async (nextLinkedNames: string[]) => {
      if (!selectedProject || !onSetLinkedContainers) {
        return
      }
      setLinkingError(null)
      await onSetLinkedContainers(selectedProject.id, nextLinkedNames)
    },
    [onSetLinkedContainers, selectedProject]
  )

  const handleAddLinkedContainer = async () => {
    if (!selectedProject || !onSetLinkedContainers) {
      return
    }

    const nextName = linkedContainerToAdd.trim()
    if (!nextName) {
      setLinkingError('Select a container to link.')
      return
    }

    const deduped = Array.from(
      new Set([...linkedContainerNames, nextName].map((entry) => entry.trim()).filter(Boolean))
    )

    try {
      await persistLinkedContainers(deduped)
      setStackActionMessage(`Linked ${nextName} to ${selectedProject.name}.`)
      setLinkingError(null)
    } catch (error) {
      setLinkingError(error instanceof Error ? error.message : 'Failed to link container.')
    }
  }

  const handleRemoveLinkedContainer = async (linkedName: string) => {
    if (!selectedProject || !onSetLinkedContainers) {
      return
    }

    const next = linkedContainerNames.filter((entry) => entry.trim().toLowerCase() !== linkedName.trim().toLowerCase())
    try {
      await persistLinkedContainers(next)
      setStackActionMessage(`Unlinked ${linkedName} from ${selectedProject.name}.`)
      setLinkingError(null)
    } catch (error) {
      setLinkingError(error instanceof Error ? error.message : 'Failed to unlink container.')
    }
  }

  const formatStackSummary = (values: string[], label: string) => {
    if (!values.length) {
      return null
    }
    return `${label}: ${values.join(', ')}`
  }

  const handleStartDevStack = async () => {
    if (!selectedProject || !onStartDevStack || stackActionLoading) {
      return
    }
    setStackActionLoading('start')
    setStackActionError(null)
    setStackActionMessage(null)
    try {
      const result = await onStartDevStack(selectedProject.id)
      const summary = [
        formatStackSummary(result.started, 'Started'),
        formatStackSummary(result.resumed, 'Resumed'),
        formatStackSummary(result.alreadyRunning, 'Already running'),
        formatStackSummary(result.missing, 'Missing links'),
      ]
        .filter(Boolean)
        .join(' | ')
      setStackActionMessage(summary || 'No linked containers to start.')
    } catch (error) {
      setStackActionError(error instanceof Error ? error.message : 'Failed to start dev stack.')
    } finally {
      setStackActionLoading(null)
    }
  }

  const handleStopDevStack = async () => {
    if (!selectedProject || !onStopDevStack || stackActionLoading) {
      return
    }
    setStackActionLoading('stop')
    setStackActionError(null)
    setStackActionMessage(null)
    try {
      const result = await onStopDevStack(selectedProject.id)
      const summary = [
        formatStackSummary(result.stopped, 'Stopped'),
        formatStackSummary(result.alreadyStopped, 'Already stopped'),
        formatStackSummary(result.missing, 'Missing links'),
      ]
        .filter(Boolean)
        .join(' | ')
      setStackActionMessage(summary || 'No linked containers to stop.')
      setStopStackDialogOpen(false)
    } catch (error) {
      setStackActionError(error instanceof Error ? error.message : 'Failed to stop dev stack.')
    } finally {
      setStackActionLoading(null)
    }
  }

  const startLiveLogs = useCallback(
    async (linkedName: string) => {
      const container = containersByName.get(linkedName.trim().toLowerCase())
      setLiveLogsTarget(linkedName)
      setLiveLogsText('')
      setLiveLogsError(null)
      setLiveLogsClosed(false)

      if (!container) {
        setLiveLogsConnecting(false)
        setLiveLogsError(`Container "${linkedName}" is not available in Docker right now.`)
        return
      }

      setLiveLogsConnecting(true)
      await unsubscribeLiveLogs()
      try {
        const { subscriptionId } = await window.electronAPI.subscribeContainerLogs(container.id, 200)
        liveLogsSubscriptionIdRef.current = subscriptionId
      } catch (error) {
        setLiveLogsError(error instanceof Error ? error.message : 'Failed to subscribe to container logs.')
      } finally {
        setLiveLogsConnecting(false)
      }
    },
    [containersByName, unsubscribeLiveLogs]
  )

  const handleOpenLiveLogs = async (linkedName: string) => {
    setLogsDialogOpen(true)
    await startLiveLogs(linkedName)
  }

  const handleRefreshLinkedContainers = async () => {
    if (!onRefreshContainers) {
      return
    }
    setStackActionError(null)
    try {
      await onRefreshContainers()
    } catch (error) {
      setStackActionError(error instanceof Error ? error.message : 'Failed to refresh containers.')
    }
  }

  const handleOpen = async (action: 'folder' | 'editor' | 'terminal') => {
    if (!selectedProject || actionLoading) return
    setActionError(null)
    setActionLoading(action)
    try {
      const result =
        action === 'folder'
          ? await window.electronAPI.openProjectFolder(selectedProject.id)
          : action === 'editor'
            ? await window.electronAPI.openProjectInEditor(selectedProject.id)
            : await window.electronAPI.openProjectInTerminal(selectedProject.id)
      if (!result.success) {
        setActionError(result.error ?? 'Unable to open project.')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to open project.')
    } finally {
      setActionLoading(null)
    }
  }

  const savePreferences = async (next: AppPreferences) => {
    if (!onSavePreferences) return
    setPrefsError(null)
    setPrefsSaving(true)
    try {
      await onSavePreferences(next)
    } catch (error) {
      setPrefsError(error instanceof Error ? error.message : 'Failed to update preferences.')
    } finally {
      setPrefsSaving(false)
    }
  }

  const updatePreference = (partial: Partial<AppPreferences>, commit = true) => {
    if (!prefsDraft) return
    const next: AppPreferences = {
      editor: {
        id: partial.editor?.id ?? prefsDraft.editor.id,
        command: partial.editor?.command ?? prefsDraft.editor.command,
      },
      terminal: {
        id: partial.terminal?.id ?? prefsDraft.terminal.id,
        command: partial.terminal?.command ?? prefsDraft.terminal.command,
      },
    }
    setPrefsDraft(next)
    if (commit) {
      void savePreferences(next)
    }
  }

  const platform = window.electronAPI.platform
  const isMac = platform === 'darwin'
  const isWindows = platform === 'win32'
  const editorOptions = isMac ? macEditorOptions : isWindows ? windowsEditorOptions : linuxEditorOptions
  const terminalOptions = isMac ? macTerminalOptions : isWindows ? windowsTerminalOptions : linuxTerminalOptions

  const handleSaveEdit = async () => {
    if (!selectedProject || !onUpdateProject || isSavingEdit) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Project name is required.')
      return
    }
    setEditError(null)
    setIsSavingEdit(true)
    try {
      await onUpdateProject(selectedProject.id, { name: trimmed })
      setEditDialogOpen(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update project.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRemoveProject = async () => {
    if (!selectedProject || !onRemoveProject || isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await onRemoveProject(selectedProject.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to remove project.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <SectionLayout
        list={
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>
                <Badge variant="outline" className="text-[10px] font-medium">{projects.length}</Badge>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                  Loading projects...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/10">
                  {error}
                </div>
              ) : projects.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                  <FolderGit2 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No projects added yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pinnedProjects.length > 0 && (
                    <>
                      <div className="px-2 py-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-600/80">Pinned</p>
                      </div>
                      {pinnedProjects.map((project) => {
                        const isActive = selectedProject?.id === project.id
                        const isWslProject = isWslPath(project.path)
                        return (
                          <button
                            key={project.id}
                            onClick={() => setSelectedId(project.id)}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                              isActive
                                ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                              isActive
                                ? "border-primary/30 bg-background text-primary"
                                : "border-border/40 bg-background/50 text-muted-foreground group-hover:border-border/60"
                            )}>
                              {project.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-none mb-1">{project.name}</p>
                              <p className="truncate text-[10px] opacity-60 font-mono tracking-tighter">{project.path}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                              {isWslProject && (
                                <Badge variant="outline" className="h-4 px-1 text-[8px] font-bold border-blue-500/20 text-blue-500 bg-blue-500/5">
                                  WSL
                                </Badge>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )}

                  {unpinnedProjects.length > 0 && (
                    <>
                      {pinnedProjects.length > 0 && (
                        <div className="px-2 pt-3 pb-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">All Projects</p>
                        </div>
                      )}
                      {unpinnedProjects.map((project) => {
                        const isActive = selectedProject?.id === project.id
                        const isWslProject = isWslPath(project.path)
                        return (
                          <button
                            key={project.id}
                            onClick={() => setSelectedId(project.id)}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                              isActive
                                ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                              isActive
                                ? "border-primary/30 bg-background text-primary"
                                : "border-border/40 bg-background/50 text-muted-foreground group-hover:border-border/60"
                            )}>
                              {project.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-none mb-1">{project.name}</p>
                              <p className="truncate text-[10px] opacity-60 font-mono tracking-tighter">{project.path}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isWslProject && (
                                <Badge variant="outline" className="h-4 px-1 text-[8px] font-bold border-blue-500/20 text-blue-500 bg-blue-500/5">
                                  WSL
                                </Badge>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedProject ? (
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl font-bold tracking-tight truncate">{selectedProject.name}</CardTitle>
                      <Badge variant="secondary" className="h-5 text-[10px] font-bold uppercase tracking-widest bg-muted/20 border-border/40">
                        {selectedProject.type}
                      </Badge>
                      <button
                        onClick={() => onToggleProjectPin?.(selectedProject.id)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          selectedProject.isPinned
                            ? "text-yellow-500 hover:bg-yellow-500/10"
                            : "text-muted-foreground/50 hover:text-yellow-500 hover:bg-muted/50"
                        )}
                        title={selectedProject.isPinned ? 'Unpin project' : 'Pin project'}
                      >
                        <Star className={cn("h-4 w-4", selectedProject.isPinned && "fill-yellow-500")} />
                      </button>
                    </div>
                    <CardDescription className="flex items-center gap-2 font-mono text-[11px] bg-muted/20 w-fit px-2 py-0.5 rounded border border-border/20">
                      {selectedProject.path}
                    </CardDescription>
                  </div>
                  {isWslPath(selectedProject.path) && (
                    <Badge variant="outline" className="gap-1.5 border-blue-500/20 text-blue-500 bg-blue-500/5 py-1 px-2">
                      <Monitor className="h-3 w-3" /> <span className="text-[10px] font-bold uppercase tracking-wider">WSL Environment</span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-auto p-8 pt-6">
                <div className="space-y-10">
                  {/* Quick Actions */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                      Execution Launchers
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('editor')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm group-hover:border-primary/20">
                          <Code2 className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Open in Editor</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('terminal')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm">
                          <Terminal className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Launch Terminal</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('folder')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm">
                          <FolderGit2 className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Open Folder</span>
                      </Button>
                    </div>
                    {actionError && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                        {actionError}
                      </div>
                    )}
                  </div>

                  {/* Dev Stack */}
                  {selectedProject &&
                  engineIndexes &&
                  engineSearchSessions &&
                  onIndexProject &&
                  onSearchProjectContent &&
                  onLoadEngineStats &&
                  onLoadEngineGitInsights &&
                  onOpenEngineResult &&
                  onRevealEngineResult &&
                  onClearProjectIndex &&
                  onClearProjectSearchSession &&
                  onOpenProjectEngine ? (
                    <ProjectEnginePanel
                      project={selectedProject}
                      engineStatus={engineStatus ?? null}
                      engineIndexes={engineIndexes}
                      searchSessions={engineSearchSessions}
                      onIndexProject={onIndexProject}
                      onSearch={onSearchProjectContent}
                      onLoadStats={onLoadEngineStats}
                      onLoadGitInsights={onLoadEngineGitInsights}
                      onOpenResult={onOpenEngineResult}
                      onRevealResult={onRevealEngineResult}
                      onClearProjectIndex={onClearProjectIndex}
                      onClearSearchSession={onClearProjectSearchSession}
                      onOpenEngine={onOpenProjectEngine}
                    />
                  ) : null}

                  {/* Dev Stack */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                        Dev Stack
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 px-2.5 text-[10px]"
                        onClick={() => void handleRefreshLinkedContainers()}
                        disabled={!onRefreshContainers || containersLoading}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', containersLoading && 'animate-spin')} />
                        Refresh
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/40 bg-muted/5 p-5 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          Linked: {linkedContainerNames.length}
                        </Badge>
                        <Badge
                          variant="success"
                          className={cn('text-[10px] uppercase tracking-wider', !linkedContainers.some(({ container }) => container?.state === 'running') && 'opacity-50')}
                        >
                          Running: {linkedContainers.filter(({ container }) => container?.state === 'running').length}
                        </Badge>
                        <Badge
                          variant="warning"
                          className={cn('text-[10px] uppercase tracking-wider', !linkedContainers.some(({ container }) => container?.state === 'paused') && 'opacity-50')}
                        >
                          Paused: {linkedContainers.filter(({ container }) => container?.state === 'paused').length}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] uppercase tracking-wider', !linkedContainers.some(({ container }) => !container || container.state === 'stopped') && 'opacity-50')}
                        >
                          Stopped/Missing: {linkedContainers.filter(({ container }) => !container || container.state === 'stopped').length}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 gap-2 text-[11px] font-semibold"
                          onClick={() => void handleStartDevStack()}
                          disabled={!onStartDevStack || linkedContainerNames.length === 0 || stackActionLoading !== null}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          {stackActionLoading === 'start' ? 'Starting...' : 'Start Dev Stack'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-2 text-[11px] font-semibold"
                          onClick={() => setStopStackDialogOpen(true)}
                          disabled={!onStopDevStack || linkedContainerNames.length === 0 || stackActionLoading !== null}
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Stop Dev Stack
                        </Button>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <Label htmlFor="link-container-select" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            Link Container
                          </Label>
                          <select
                            id="link-container-select"
                            className={cn(selectClass, 'bg-background shadow-sm')}
                            value={linkedContainerToAdd}
                            onChange={(event) => setLinkedContainerToAdd(event.target.value)}
                            disabled={linkableContainers.length === 0 || !onSetLinkedContainers}
                          >
                            {linkableContainers.length > 0 ? (
                              linkableContainers.map((container) => (
                                <option key={container.id} value={container.name}>
                                  {container.name} ({container.state})
                                </option>
                              ))
                            ) : (
                              <option value="">No additional containers found</option>
                            )}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-2 text-[11px] font-semibold"
                            onClick={() => void handleAddLinkedContainer()}
                            disabled={!onSetLinkedContainers || !linkedContainerToAdd.trim() || linkableContainers.length === 0}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Link
                          </Button>
                        </div>
                      </div>

                      {containersError ? (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive">
                          {containersError}
                        </div>
                      ) : null}
                      {linkingError ? (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive">
                          {linkingError}
                        </div>
                      ) : null}
                      {stackActionError ? (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive">
                          {stackActionError}
                        </div>
                      ) : null}
                      {stackActionMessage ? (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-[11px] text-primary/90">
                          {stackActionMessage}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {linkedContainers.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/40 px-3 py-5 text-center text-[11px] text-muted-foreground">
                            Link containers to this project to enable one-click dev stack controls.
                          </div>
                        ) : (
                          linkedContainers.map(({ linkedName, container }) => (
                            <div
                              key={linkedName}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{linkedName}</p>
                                <p className="truncate text-[10px] text-muted-foreground font-mono">
                                  {container ? container.image : 'Container not found in current Docker list'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={container ? containerStateBadge[container.state] : 'outline'}
                                  className="text-[10px] uppercase tracking-wider"
                                >
                                  {container?.state ?? 'missing'}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => void handleOpenLiveLogs(linkedName)}
                                >
                                  Live Logs
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                  onClick={() => void handleRemoveLinkedContainer(linkedName)}
                                  disabled={!onSetLinkedContainers}
                                >
                                  Unlink
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preferences */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                        Launch Configuration
                      </h3>
                      {prefsSaving && (
                        <div className="flex items-center gap-2 text-[10px] text-primary/70 font-semibold uppercase tracking-wider">
                          <div className="h-2 w-2 animate-spin rounded-full border border-primary border-r-transparent" />
                          Auto-saving
                        </div>
                      )}
                    </div>
                    
                    <div className="grid gap-8 md:grid-cols-2 p-5 rounded-xl border border-border/40 bg-muted/5">
                      <div className="space-y-3">
                        <Label htmlFor="preferred-editor" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Preferred IDE</Label>
                        <select
                          id="preferred-editor"
                          className={cn(selectClass, "bg-background shadow-sm")}
                          value={prefsDraft?.editor.id ?? ''}
                          onChange={(event) =>
                            updatePreference({
                              editor: { id: event.target.value, command: prefsDraft?.editor.command },
                            })
                          }
                          disabled={!prefsDraft}
                        >
                          {editorOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {prefsDraft?.editor.id === 'custom' && (
                          <div className="pt-1">
                            <Input
                              value={prefsDraft.editor.command ?? ''}
                              onChange={(event) =>
                                updatePreference(
                                  { editor: { id: 'custom', command: event.target.value } },
                                  false
                                )
                              }
                              onBlur={() =>
                                updatePreference({ editor: { id: 'custom', command: prefsDraft?.editor.command } })
                              }
                              placeholder={isMac ? 'open -a "App" {path}' : 'code {path}'}
                              className="h-8 text-[11px] font-mono bg-background"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="preferred-terminal" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Terminal Emulator</Label>
                        <select
                          id="preferred-terminal"
                          className={cn(selectClass, "bg-background shadow-sm")}
                          value={prefsDraft?.terminal.id ?? ''}
                          onChange={(event) =>
                            updatePreference({
                              terminal: { id: event.target.value, command: prefsDraft?.terminal.command },
                            })
                          }
                          disabled={!prefsDraft}
                        >
                          {terminalOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {prefsDraft?.terminal.id === 'custom' && (
                          <div className="pt-1">
                            <Input
                              value={prefsDraft.terminal.command ?? ''}
                              onChange={(event) =>
                                updatePreference(
                                  { terminal: { id: 'custom', command: event.target.value } },
                                  false
                                )
                              }
                              onBlur={() =>
                                updatePreference({ terminal: { id: 'custom', command: prefsDraft?.terminal.command } })
                              }
                              placeholder={isMac ? 'open -a "Term" {path}' : 'wt -d {path}'}
                              className="h-8 text-[11px] font-mono bg-background"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {prefsError && <p className="text-[11px] text-destructive bg-destructive/5 p-2 rounded border border-destructive/10">{prefsError}</p>}
                  </div>
                </div>
              </CardContent>

              <div className="border-t border-border/40 bg-muted/5 p-5">
                <div className="flex justify-between items-center px-1">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => setEditDialogOpen(true)}
                      disabled={!onUpdateProject}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveProject}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
              <div className="max-w-[240px] space-y-4 opacity-40">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                  <FolderGit2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Workspace</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Select a project from the explorer list to manage execution environments and settings.</p>
                </div>
              </div>
            </Card>
          )
        }
      />
      <Dialog
        open={stopStackDialogOpen}
        onOpenChange={(open) => {
          setStopStackDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop linked dev stack?</DialogTitle>
            <DialogDescription>
              This will stop all linked running containers for {selectedProject?.name ?? 'this project'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopStackDialogOpen(false)} disabled={stackActionLoading === 'stop'}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleStopDevStack()} disabled={stackActionLoading === 'stop'}>
              {stackActionLoading === 'stop' ? 'Stopping...' : 'Stop Dev Stack'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={logsDialogOpen}
        onOpenChange={(open) => {
          setLogsDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Live Container Logs</DialogTitle>
            <DialogDescription>
              {liveLogsTarget
                ? `Streaming logs for ${liveLogsTarget}.`
                : 'Select a linked container to stream logs.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {linkedContainers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {linkedContainers.map(({ linkedName, container }) => (
                  <Button
                    key={`logs-target-${linkedName}`}
                    size="sm"
                    variant={linkedName === liveLogsTarget ? 'default' : 'outline'}
                    className="h-7 px-2 text-[10px]"
                    onClick={() => void startLiveLogs(linkedName)}
                    disabled={!container}
                  >
                    {linkedName}
                  </Button>
                ))}
              </div>
            ) : null}
            {liveLogsError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {liveLogsError}
              </div>
            ) : null}
            {liveLogsClosed ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
                Log stream ended.
              </div>
            ) : null}
            <div className="rounded-lg border border-border/40 bg-black text-green-300">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-widest text-white/60">
                <span>{liveLogsTarget ?? 'No container selected'}</span>
                <span>{liveLogsConnecting ? 'Connecting...' : 'Streaming'}</span>
              </div>
              <ScrollArea className="h-[380px]">
                <pre className="whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed">
                  {liveLogsText || (liveLogsConnecting ? 'Connecting to log stream...' : 'No log output yet.')}
                </pre>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (open && selectedProject) {
            setEditName(selectedProject.name)
          }
          if (!open) {
            setEditError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the project name shown in the sidebar and details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project name</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-path">Project path</Label>
              <Input id="edit-project-path" value={selectedProject?.path ?? ''} readOnly className="bg-muted font-mono text-xs" />
            </div>
            {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !onUpdateProject}>
              {isSavingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove project?</DialogTitle>
            <DialogDescription>
              This removes the project, its notes, and run history from DevDesk. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveProject} disabled={isDeleting || !onRemoveProject}>
              {isDeleting ? 'Removing...' : 'Remove project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
