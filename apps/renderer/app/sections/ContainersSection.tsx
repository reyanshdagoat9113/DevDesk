import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Logs,
  Pause,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Search,
  Square,
  Trash2,
  X,
  ArrowUpDown,
  Activity,
  Box,
  Terminal as TerminalIcon,
  Layers,
  Network
} from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
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
import { ScrollArea } from '../components/ui/ScrollArea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select'
import { Separator } from '../components/ui/Separator'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type { Container, Project } from '../types'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusNotice } from '../components/ui/StatusNotice'
import { EmptyState } from '../components/ui/EmptyState'

const statusStyles: Record<Container['state'], string> = {
  running: 'bg-status-success',
  stopped: 'bg-muted-foreground/40',
  paused: 'bg-status-warning',
}

const stateBadgeVariants: Record<Container['state'], 'success' | 'warning' | 'outline'> = {
  running: 'success',
  paused: 'warning',
  stopped: 'outline',
}

const stateOrder: Record<Container['state'], number> = {
  running: 0,
  paused: 1,
  stopped: 2,
}

type FilterValue = 'all' | Container['state']
type SortValue = 'name' | 'state' | 'created'

const getCreatedTimestamp = (value?: string) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function ContainersSection({
  containers,
  projects,
  isLoading,
  error,
  onStartContainer,
  onStopContainer,
  onRestartContainer,
  onPauseContainer,
  onUnpauseContainer,
  onRemoveContainer,
  onViewLogs,
  onRefreshContainers,
}: {
  containers: Container[]
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  onStartContainer?: (containerId: string) => Promise<void>
  onStopContainer?: (containerId: string) => Promise<void>
  onRestartContainer?: (containerId: string) => Promise<void>
  onPauseContainer?: (containerId: string) => Promise<void>
  onUnpauseContainer?: (containerId: string) => Promise<void>
  onRemoveContainer?: (containerId: string, force?: boolean) => Promise<void>
  onViewLogs?: (containerId: string) => Promise<string>
  onRefreshContainers?: () => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(containers[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all')
  const [sortBy, setSortBy] = useState<SortValue>('name')
  const [refreshing, setRefreshing] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removeTargetIds, setRemoveTargetIds] = useState<string[]>([])
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeMessage, setRemoveMessage] = useState<string | null>(null)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [stopTargetIds, setStopTargetIds] = useState<string[]>([])
  const [stopLoading, setStopLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  const [logsOpen, setLogsOpen] = useState(false)
  const [logsText, setLogsText] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()

  const filteredContainers = useMemo(() => {
    return containers.filter((container) => {
      if (statusFilter !== 'all' && container.state !== statusFilter) return false
      if (!normalizedQuery) return true
      const haystack = [
        container.name,
        container.image,
        container.id,
        container.status,
        container.command,
        ...(container.labels ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [containers, normalizedQuery, statusFilter])

  const sortedContainers = useMemo(() => {
    const list = [...filteredContainers]
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'state') {
        const order = stateOrder[a.state] - stateOrder[b.state]
        return order !== 0 ? order : a.name.localeCompare(b.name)
      }
      if (sortBy === 'created') {
        return getCreatedTimestamp(b.createdAt) - getCreatedTimestamp(a.createdAt)
      }
      return 0
    })
    return list
  }, [filteredContainers, sortBy])

  useEffect(() => {
    if (!sortedContainers.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !sortedContainers.some((container) => container.id === selectedId)) {
      setSelectedId(sortedContainers[0].id)
    }
  }, [sortedContainers, selectedId])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => containers.some((container) => container.id === id)))
  }, [containers])

  const selectedContainer = useMemo(() => {
    if (!sortedContainers.length) return null
    return sortedContainers.find((container) => container.id === selectedId) ?? sortedContainers[0]
  }, [sortedContainers, selectedId])

  const linkedProjectsByContainerName = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const project of projects) {
      const uniqueNames = new Set((project.linkedContainerNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean))
      for (const name of uniqueNames) {
        const current = map.get(name)
        if (current) {
          current.push(project.name)
        } else {
          map.set(name, [project.name])
        }
      }
    }
    return map
  }, [projects])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = useMemo(() => sortedContainers.map((container) => container.id), [sortedContainers])
  const visibleSelectedCount = useMemo(
    () => visibleIds.filter((id) => selectedIdSet.has(id)).length,
    [visibleIds, selectedIdSet]
  )
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected
    }
  }, [someVisibleSelected, allVisibleSelected])

  const selectedContainers = useMemo(
    () => containers.filter((container) => selectedIdSet.has(container.id)),
    [containers, selectedIdSet]
  )

  const canStartBulk = selectedContainers.some((container) => container.state === 'stopped')
  const canStopBulk = selectedContainers.some((container) => container.state !== 'stopped')
  const canPauseBulk = selectedContainers.some((container) => container.state === 'running')
  const canUnpauseBulk = selectedContainers.some((container) => container.state === 'paused')
  const canRestartBulk = selectedContainers.length > 0

  const removeTargets = useMemo(() => {
    return removeTargetIds
      .map((id) => containers.find((container) => container.id === id))
      .filter((container): container is Container => Boolean(container))
  }, [removeTargetIds, containers])

  const stopTargets = useMemo(
    () => containers.filter((container) => stopTargetIds.includes(container.id) && container.state !== 'stopped'),
    [containers, stopTargetIds]
  )

  const openRemoveDialog = (ids: string[]) => {
    if (!onRemoveContainer || !ids.length) return
    setRemoveTargetIds(ids)
    setRemoveError(null)
    setRemoveDialogOpen(true)
  }

  const openStopDialog = (ids: string[]) => {
    if (!onStopContainer || !ids.length) return
    setStopTargetIds(ids)
    setActionError(null)
    setStopDialogOpen(true)
  }

  const handleConfirmRemove = async (force: boolean) => {
    if (!onRemoveContainer || !removeTargetIds.length || removeLoading) return
    setRemoveLoading(true)
    setRemoveError(null)
    try {
      for (const id of removeTargetIds) {
        await onRemoveContainer(id, force)
      }
      setSelectedIds((prev) => prev.filter((id) => !removeTargetIds.includes(id)))
      setRemoveDialogOpen(false)
      setRemoveTargetIds([])
      setRemoveMessage(`Removed ${removeTargets.length} container${removeTargets.length === 1 ? '' : 's'} from Docker.`)
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Failed to remove containers.')
    } finally {
      setRemoveLoading(false)
    }
  }

  const toggleSelected = (containerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(containerId) ? prev.filter((id) => id !== containerId) : [...prev, containerId]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? visibleIds : [])
  }

  const handleRefresh = async () => {
    if (!onRefreshContainers || refreshing) return
    setRefreshing(true)
    setActionError(null)
    try {
      await onRefreshContainers()
      setActionMessage('Container list refreshed.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to refresh containers.')
    } finally {
      setRefreshing(false)
    }
  }

  const runContainerAction = async (
    action: string,
    handler: ((containerId: string) => Promise<void>) | undefined,
    containerId: string
  ) => {
    if (!handler) return
    setActionLoading(`${action}:${containerId}`)
    setActionError(null)
    setActionMessage(null)
    try {
      await handler(containerId)
      setActionMessage(`${action[0].toUpperCase()}${action.slice(1)} completed for ${containers.find((container) => container.id === containerId)?.name ?? 'container'}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Failed to ${action} container.`)
    } finally {
      setActionLoading(null)
    }
  }

  const runBulkAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause', requestedIds = selectedIds) => {
    if (bulkActionLoading) return
    const handlers = {
      start: onStartContainer,
      stop: onStopContainer,
      restart: onRestartContainer,
      pause: onPauseContainer,
      unpause: onUnpauseContainer,
    }
    const handler = handlers[action]
    if (!handler) return
    const targetIds = containers.filter((container) => {
      if (!requestedIds.includes(container.id)) return false
      if (action === 'start') return container.state === 'stopped'
      if (action === 'stop') return container.state !== 'stopped'
      if (action === 'pause') return container.state === 'running'
      if (action === 'unpause') return container.state === 'paused'
      return true
    })
      .filter((container) => {
        if (action === 'start') return container.state === 'stopped'
        if (action === 'stop') return container.state !== 'stopped'
        if (action === 'pause') return container.state === 'running'
        if (action === 'unpause') return container.state === 'paused'
      return true
    })
    if (!targetIds.length) return false
    setBulkActionLoading(true)
    setActionError(null)
    setActionMessage(null)
    try {
      for (const container of targetIds) {
        await handler(container.id)
      }
      setSelectedIds([])
      setActionMessage(`${action[0].toUpperCase()}${action.slice(1)} completed for ${targetIds.length} selected container${targetIds.length === 1 ? '' : 's'}.`)
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Failed to ${action} selected containers.`)
      return false
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleConfirmStop = async () => {
    if (stopLoading || !stopTargetIds.length) return
    setStopLoading(true)
    const completed = await runBulkAction('stop', stopTargetIds)
    if (completed) {
      setStopDialogOpen(false)
      setStopTargetIds([])
    }
    setStopLoading(false)
  }

  const handleViewLogs = async () => {
    if (!selectedContainer || !onViewLogs) return
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsError(null)
    try {
      const output = await onViewLogs(selectedContainer.id)
      setLogsText(output ?? '')
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : 'Failed to load logs.')
      setLogsText('')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleViewLogsFor = async (containerId: string) => {
    if (!onViewLogs) return
    setSelectedId(containerId)
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsError(null)
    try {
      const output = await onViewLogs(containerId)
      setLogsText(output ?? '')
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : 'Failed to load logs.')
      setLogsText('')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleCopyLogs = async () => {
    if (!logsText) return
    try {
      await navigator.clipboard.writeText(logsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const logsDisplay = logsLoading
    ? 'Loading logs...'
    : logsError
      ? logsError
      : logsText || 'No logs returned.'

  const detailActionBusy = selectedContainer
    ? actionLoading?.endsWith(`:${selectedContainer.id}`) ?? false
    : false

  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    selectedContainer?.labels?.forEach((label) => {
      const [key, ...rest] = label.split('=')
      if (!key || rest.length === 0) return
      map.set(key, rest.join('='))
    })
    return map
  }, [selectedContainer?.labels])

  const composeProject = labelMap.get('com.docker.compose.project')
  const composeService = labelMap.get('com.docker.compose.service')
  const selectedLinkedProjects = selectedContainer
    ? linkedProjectsByContainerName.get(selectedContainer.name.trim().toLowerCase()) ?? []
    : []

  const removePreview = removeTargets.slice(0, 4)
  const removeOverflow = Math.max(0, removeTargets.length - removePreview.length)

  return (
    <>
      <SectionLayout
        list={
          <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
            <div className="flex flex-col border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Containers</p>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium opacity-70">
                    {containers.length}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleRefresh}
                  disabled={!onRefreshContainers || refreshing}
                  aria-label="Refresh containers"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </Button>
              </div>

              <div className="space-y-3 px-4 pb-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search containers..."
                    className="h-8 pl-9 text-xs focus-visible:ring-1 bg-background/50"
                  />
                </div>

                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterValue)} className="w-full">
                  <TabsList className="grid h-8 w-full grid-cols-4 bg-muted/50 p-0.5">
                    <TabsTrigger value="all" className="text-[10px] uppercase tracking-wider">All</TabsTrigger>
                    <TabsTrigger value="running" className="text-[10px] uppercase tracking-wider">Active</TabsTrigger>
                    <TabsTrigger value="paused" className="text-[10px] uppercase tracking-wider">Paused</TabsTrigger>
                    <TabsTrigger value="stopped" className="text-[10px] uppercase tracking-wider">Off</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center justify-between gap-2">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortValue)}>
                    <SelectTrigger className="h-7 w-[120px] border-none bg-transparent px-0 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:ring-0">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-3 w-3" />
                        <SelectValue placeholder="Sort by" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="state">Status</SelectItem>
                      <SelectItem value="created">Created</SelectItem>
                    </SelectContent>
                  </Select>

                  {sortedContainers.length > 0 && (
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => handleSelectAll(event.target.checked)}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/30 bg-background text-primary transition-colors focus:ring-primary/20"
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>
            </div>
            {selectedIds.length > 0 && (
              <div className="border-b border-border/40 bg-primary/5 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" />
                    {selectedIds.length} SELECTED
                  </div>
                  <div className="flex items-center gap-1">
                    {canStartBulk && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => runBulkAction('start')}
                        disabled={bulkActionLoading}
                        aria-label="Start selected containers"
                        title="Start selected"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canRestartBulk && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => runBulkAction('restart')}
                        disabled={bulkActionLoading}
                        aria-label="Restart selected containers"
                        title="Restart selected"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(canPauseBulk || canUnpauseBulk) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => runBulkAction(canPauseBulk ? 'pause' : 'unpause')}
                        disabled={bulkActionLoading}
                        aria-label={canPauseBulk ? "Pause selected containers" : "Unpause selected containers"}
                        title={canPauseBulk ? "Pause selected" : "Unpause selected"}
                      >
                        {canPauseBulk ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {canStopBulk && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openStopDialog(selectedIds)}
                        disabled={bulkActionLoading}
                        aria-label="Stop selected containers"
                        title="Stop selected"
                      >
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openRemoveDialog(selectedIds)}
                      disabled={bulkActionLoading}
                      aria-label="Remove selected containers"
                      title="Remove selected"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-4" />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedIds([])}
                      aria-label="Clear selection"
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <LoadingState label="Loading containers" description="Scanning Docker host…" className="h-full" />
              ) : error ? (
                <ErrorState title="Docker containers unavailable" description={error} onRetry={() => void handleRefresh()} retryLabel="Retry connection" className="h-full" />
              ) : containers.length === 0 ? (
                <EmptyState
                  className="h-full"
                  icon={<Box className="h-5 w-5" />}
                  title="No containers detected"
                  description="Start Docker or connect a project with containers, then refresh this list."
                  action={onRefreshContainers ? <Button size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>Refresh containers</Button> : undefined}
                />
              ) : sortedContainers.length === 0 ? (
                <EmptyState
                  className="h-full"
                  title="No matching containers"
                  description="Try a different name, state, or sort selection."
                />
              ) : (
                <div className="space-y-1">
                  {sortedContainers.map((container) => {
                    const isActive = selectedId === container.id
                    const isSelected = selectedIdSet.has(container.id)
                    const isBusy = actionLoading?.endsWith(`:${container.id}`)
                    const statusText = container.status || container.state
                    const linkedProjectNames = linkedProjectsByContainerName.get(container.name.trim().toLowerCase()) ?? []

                    return (
                      <div
                        key={container.id}
                        onClick={() => setSelectedId(container.id)}
                        className={cn(
                          "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                          isActive 
                            ? "bg-primary/10 shadow-sm ring-1 ring-primary/20" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(container.id)}
                            className="h-3.5 w-3.5 rounded border-muted-foreground/30 bg-background text-primary transition-colors focus:ring-primary/20 cursor-pointer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusStyles[container.state])} />
                            <span className={cn("truncate text-sm font-bold leading-none", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                              {container.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 truncate text-[10px] text-muted-foreground/60 font-mono tracking-tighter">
                            <span className="truncate max-w-[100px]">{container.image}</span>
                            {statusText && (
                              <>
                                <span className="opacity-30">•</span>
                                <span className="truncate italic opacity-80">{statusText}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {linkedProjectNames.length > 0 ? (
                              linkedProjectNames.slice(0, 2).map((projectName) => (
                                <Badge
                                  key={`${container.id}:${projectName}`}
                                  variant="outline"
                                  className="h-4 px-1 text-[8px] font-bold uppercase tracking-tighter"
                                >
                                  {projectName}
                                </Badge>
                              ))
                            ) : (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[8px] uppercase tracking-tighter text-muted-foreground/70"
                              >
                                unlinked
                              </Badge>
                            )}
                            {linkedProjectNames.length > 2 ? (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[8px] uppercase tracking-tighter text-muted-foreground/70"
                              >
                                +{linkedProjectNames.length - 2}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={stateBadgeVariants[container.state]}
                            className="h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter"
                          >
                            {container.state}
                          </Badge>

                          <div className={cn("flex items-center gap-0.5 opacity-0 transition-opacity", (isActive || isBusy) ? "opacity-100" : "group-hover:opacity-100")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/50 rounded-md"
                              onClick={(e) => { e.stopPropagation(); handleViewLogsFor(container.id); }}
                              disabled={isBusy}
                              aria-label={`View logs for ${container.name}`}
                            >
                              <Logs className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/50 rounded-md"
                              onClick={(e) => {
                                e.stopPropagation()
                                runContainerAction('restart', onRestartContainer, container.id)
                              }}
                              disabled={isBusy}
                              aria-label={`Restart ${container.name}`}
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedContainer ? (
            <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent shadow-none">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded bg-status-info/10 p-1.5 text-status-info">
                        <Box className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-2xl font-bold tracking-tight truncate">{selectedContainer.name}</CardTitle>
                      <Badge variant={stateBadgeVariants[selectedContainer.state]} className="h-5 text-[10px] font-bold uppercase tracking-widest ml-1">
                        {selectedContainer.state}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 font-mono text-[11px] bg-muted/20 w-fit px-2 py-0.5 rounded border border-border/20">
                      {selectedContainer.image}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider border-border/40 bg-background/50"
                      onClick={handleViewLogs}
                      disabled={!onViewLogs || detailActionBusy}
                    >
                      <Logs className="h-3.5 w-3.5" />
                      Console Logs
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-border/40 bg-background/50"
                      onClick={() => void runContainerAction('restart', onRestartContainer, selectedContainer.id)}
                      disabled={!onRestartContainer || detailActionBusy}
                      aria-label="Restart container"
                      title="Restart"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-auto p-8 pt-6 space-y-10">
                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Activity className="h-3.5 w-3.5" />
                      Status & Timeline
                    </h3>
                    <div className="space-y-4 p-5 rounded-xl border border-border/40 bg-muted/5">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Runtime State</p>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", statusStyles[selectedContainer.state])} />
                          {selectedContainer.status || selectedContainer.state}
                        </p>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-border/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Created Date</p>
                        <p className="text-[13px] font-medium text-foreground/80">{selectedContainer.createdAt || 'Unknown execution date'}</p>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-border/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Unique ID</p>
                        <p className="font-mono text-[11px] text-muted-foreground break-all">{selectedContainer.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Network className="h-3.5 w-3.5" />
                      Environment Context
                    </h3>
                    <div className="space-y-4 p-5 rounded-xl border border-border/40 bg-muted/5 h-full">
                      {(composeProject || composeService) ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">
                            <Layers className="h-3 w-3" /> Docker Compose
                          </div>
                          {composeProject && (
                            <div className="flex justify-between items-center text-[13px]">
                              <span className="text-muted-foreground">Project:</span>
                              <span className="font-bold">{composeProject}</span>
                            </div>
                          )}
                          {composeService && (
                            <div className="flex justify-between items-center text-[13px]">
                              <span className="text-muted-foreground">Service:</span>
                              <span className="font-bold text-primary">{composeService}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-12 text-[11px] text-muted-foreground/50 italic font-medium">
                          Standalone Container
                        </div>
                      )}

                      <div className="pt-3 border-t border-border/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
                          Linked Projects
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLinkedProjects.length > 0 ? (
                            selectedLinkedProjects.map((projectName) => (
                              <Badge
                                key={`linked-project-${selectedContainer.id}-${projectName}`}
                                variant="outline"
                                className="text-[10px] font-semibold"
                              >
                                {projectName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground/40 font-medium">
                              No linked projects
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-border/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">Mapped Ports</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedContainer.ports.length > 0 ? (
                            selectedContainer.ports.map((port) => (
                              <Badge key={port} variant="secondary" className="font-mono text-[10px] bg-background border-border/40">
                                {port}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground/40 font-medium">No external bindings</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Execution Details */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <TerminalIcon className="h-3.5 w-3.5" />
                    Runtime Execution Instruction
                  </h3>
                  <div className="relative overflow-hidden rounded-lg border border-code-border bg-code p-4 font-mono text-ui-code text-code-foreground shadow-inner">
                    <div className="absolute left-0 top-0 h-full w-1 bg-status-info/40" />
                    <span className="opacity-40 mr-3 select-none">$</span>
                    {selectedContainer.command || 'No explicit entrypoint instruction'}
                  </div>
                </div>

                {/* Metadata Labels */}
                {selectedContainer.labels && selectedContainer.labels.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Metadata Labels</h3>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-auto pr-2 custom-scrollbar">
                      {selectedContainer.labels.map((label) => {
                        const [k, v] = label.split('=')
                        return (
                          <div key={label} className="flex flex-col p-2 rounded-lg border border-border/20 bg-muted/5 overflow-hidden">
                            <span className="text-[9px] font-bold text-muted-foreground/60 truncate uppercase tracking-tighter mb-0.5">{k}</span>
                            <span className="text-[11px] font-mono truncate text-foreground/80">{v || 'true'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>

              <div className="border-t border-border/40 bg-muted/5 p-6">
                <div className="flex gap-4">
                  {selectedContainer.state === 'running' ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 gap-2 font-bold uppercase tracking-wider text-[11px] bg-background border-border/40"
                        onClick={() => void runContainerAction('pause', onPauseContainer, selectedContainer.id)}
                        disabled={!onPauseContainer || detailActionBusy}
                      >
                        <Pause className="h-4 w-4" />
                        Pause execution
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-10 gap-2 font-bold uppercase tracking-wider text-[11px] bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-white transition-all"
                        onClick={() => openStopDialog([selectedContainer.id])}
                        disabled={!onStopContainer || detailActionBusy}
                      >
                        <Square className="h-4 w-4" />
                        Terminate process
                      </Button>
                    </>
                  ) : selectedContainer.state === 'paused' ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 gap-2 font-bold uppercase tracking-wider text-[11px] bg-background border-border/40"
                        onClick={() => void runContainerAction('unpause', onUnpauseContainer, selectedContainer.id)}
                        disabled={!onUnpauseContainer || detailActionBusy}
                      >
                        <Play className="h-4 w-4" />
                        Resume service
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-10 gap-2 font-bold uppercase tracking-wider text-[11px] bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-white transition-all"
                        onClick={() => openStopDialog([selectedContainer.id])}
                        disabled={!onStopContainer || detailActionBusy}
                      >
                        <Square className="h-4 w-4" />
                        Terminate
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="flex-1 h-10 gap-2 font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-primary/10"
                      onClick={() => void runContainerAction('start', onStartContainer, selectedContainer.id)}
                      disabled={!onStartContainer || detailActionBusy}
                    >
                      <Power className="h-4 w-4" />
                      Instantiate Container
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/40 transition-colors"
                    onClick={() => openRemoveDialog([selectedContainer.id])}
                    disabled={!onRemoveContainer || detailActionBusy}
                    aria-label="Remove container"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {actionError ? <StatusNotice tone="error" title="Container action failed">{actionError}</StatusNotice> : null}
                {actionMessage ? <StatusNotice tone="success" title="Container action complete">{actionMessage}</StatusNotice> : null}
                {removeMessage ? <StatusNotice tone="success" title="Container removed">{removeMessage}</StatusNotice> : null}
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
              <div className="max-w-[240px] space-y-4 opacity-40">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                  <Box className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Docker Engine</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Select a container instance to inspect runtime metadata, manage lifecycle, or review console logs.</p>
                </div>
              </div>
            </Card>
          )
        }
      />
      <Dialog
        open={logsOpen}
        onOpenChange={(open) => {
          setLogsOpen(open)
          if (!open) {
            setLogsError(null)
            setLogsLoading(false)
            setLogsText('')
            setCopied(false)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
            <DialogDescription>Latest output for {selectedContainer?.name ?? 'container'}.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/60">
            <ScrollArea className="h-[50vh]">
              <pre className="p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {logsDisplay}
              </pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopyLogs} disabled={!logsText}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Logs
                </>
              )}
            </Button>
            <Button onClick={() => setLogsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stopDialogOpen}
        onOpenChange={(open) => {
          setStopDialogOpen(open)
          if (!open) setStopTargetIds([])
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop container{stopTargets.length === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This stops the selected running or paused Docker container{stopTargets.length === 1 ? '' : 's'} and interrupts active processes. It does not remove the container or its data.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            {stopTargets.map((container) => <div key={container.id} className="font-medium">{container.name}</div>)}
          </div>
          {actionError ? <StatusNotice tone="error" title="Stop failed">{actionError}</StatusNotice> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopDialogOpen(false)} disabled={stopLoading}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleConfirmStop()} disabled={stopLoading || !stopTargets.length}>
              {stopLoading ? 'Stopping…' : `Stop ${stopTargets.length || ''} container${stopTargets.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open)
          if (!open) setRemoveError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Containers</DialogTitle>
            <DialogDescription>
              This permanently removes the selected container{removeTargets.length === 1 ? '' : 's'} from Docker. Stopped containers can be recreated only if their image or compose definition is still available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {removeTargets.length} container{removeTargets.length === 1 ? '' : 's'} selected.
            </p>
            {removePreview.length ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="space-y-1">
                  {removePreview.map((container) => (
                    <div key={container.id} className="flex flex-col">
                      <span className="font-medium text-foreground">{container.name}</span>
                      <span className="break-all">{container.id}</span>
                    </div>
                  ))}
                  {removeOverflow > 0 ? (
                    <div className="text-muted-foreground">+{removeOverflow} more</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {removeError ? <StatusNotice tone="error" title="Container removal failed">{removeError}</StatusNotice> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={removeLoading}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleConfirmRemove(false)}
              disabled={!onRemoveContainer || removeLoading}
            >
              Remove
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmRemove(true)}
              disabled={!onRemoveContainer || removeLoading}
            >
              Force Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
