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
  Filter,
  ArrowUpDown,
  Activity,
  Box,
  Hash,
  Clock,
  Terminal as TerminalIcon,
  Layers,
  Network
} from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
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
import type { Container } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

const statusStyles: Record<Container['state'], string> = {
  running: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  stopped: 'bg-muted-foreground/40',
  paused: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]',
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

  const openRemoveDialog = (ids: string[]) => {
    if (!onRemoveContainer || !ids.length) return
    setRemoveTargetIds(ids)
    setRemoveDialogOpen(true)
  }

  const handleConfirmRemove = async (force: boolean) => {
    if (!onRemoveContainer || !removeTargetIds.length || removeLoading) return
    setRemoveLoading(true)
    try {
      for (const id of removeTargetIds) {
        await onRemoveContainer(id, force)
      }
      setSelectedIds((prev) => prev.filter((id) => !removeTargetIds.includes(id)))
      setRemoveDialogOpen(false)
      setRemoveTargetIds([])
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
    try {
      await onRefreshContainers()
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
    try {
      await handler(containerId)
    } finally {
      setActionLoading(null)
    }
  }

  const runBulkAction = async (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
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
    const targetIds = selectedContainers
      .filter((container) => {
        if (action === 'start') return container.state === 'stopped'
        if (action === 'stop') return container.state !== 'stopped'
        if (action === 'pause') return container.state === 'running'
        if (action === 'unpause') return container.state === 'paused'
        return true
      })
      .map((container) => container.id)
    if (!targetIds.length) return
    setBulkActionLoading(true)
    try {
      for (const id of targetIds) {
        await handler(id)
      }
      setSelectedIds([])
    } finally {
      setBulkActionLoading(false)
    }
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

  const removePreview = removeTargets.slice(0, 4)
  const removeOverflow = Math.max(0, removeTargets.length - removePreview.length)

  return (
    <>
      <SectionLayout
        list={
          <div className={panelClass}>
            <div className="flex flex-col border-b border-border/60 bg-muted/30">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Containers</p>
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
                    className="h-8 pl-9 text-xs focus-visible:ring-1"
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
                        className="h-3 w-3 rounded border-muted-foreground/30 bg-background text-primary transition-colors focus:ring-primary/20"
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>
            </div>
            {selectedIds.length > 0 && (
              <div className="border-b border-border/60 bg-primary/5 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
                    <Check className="h-3 w-3" />
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
                        onClick={() => runBulkAction('stop')}
                        disabled={bulkActionLoading}
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
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-muted-foreground/60">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span className="text-xs font-medium">Scanning Docker...</span>
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                    <Activity className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-medium text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2 h-8 text-[11px]">
                    Try again
                  </Button>
                </div>
              ) : containers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center opacity-40">
                  <Box className="h-10 w-10" />
                  <p className="text-xs font-medium">No containers found</p>
                </div>
              ) : sortedContainers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center opacity-40">
                  <Filter className="h-8 w-8" />
                  <p className="text-xs font-medium">No matches for your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {sortedContainers.map((container) => {
                    const isActive = selectedId === container.id
                    const isSelected = selectedIdSet.has(container.id)
                    const isBusy = actionLoading?.endsWith(`:${container.id}`)
                    const statusText = container.status || container.state

                    return (
                      <div
                        key={container.id}
                        className={cn(
                          "group relative flex w-full flex-col transition-colors",
                          isActive ? "bg-accent/40" : "hover:bg-accent/20"
                        )}
                      >
                        <div
                          className="flex cursor-pointer items-center gap-3 px-4 py-3"
                          onClick={() => setSelectedId(container.id)}
                        >
                          <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelected(container.id)}
                              className="h-3.5 w-3.5 rounded border-muted-foreground/30 bg-background text-primary transition-colors focus:ring-primary/20"
                            />
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-1.5 w-1.5 rounded-full", statusStyles[container.state])} />
                              <span className="truncate text-sm font-semibold tracking-tight">{container.name}</span>
                            </div>
                            <div className="flex items-center gap-2 truncate text-[11px] text-muted-foreground/70">
                              <span className="truncate">{container.image}</span>
                              {statusText && (
                                <>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span className="truncate italic">{statusText}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant={stateBadgeVariants[container.state]}
                              className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-tighter"
                            >
                              {container.state}
                            </Badge>

                            <div className="hidden group-hover:flex">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); handleViewLogsFor(container.id); }}
                                disabled={isBusy}
                              >
                                <Logs className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  runContainerAction('restart', onRestartContainer, container.id)
                                }}
                                disabled={isBusy}
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        {isActive && (
                          <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        }
        detail={
          <div className={cn(panelClass, "bg-card/40")}>
            {selectedContainer ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-bold tracking-tight">{selectedContainer.name}</h2>
                        <Badge variant={stateBadgeVariants[selectedContainer.state]} className="h-5 px-1.5 text-[10px] font-bold uppercase">
                          {selectedContainer.state}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{selectedContainer.image}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-[11px] font-semibold"
                        onClick={handleViewLogs}
                        disabled={!onViewLogs || detailActionBusy}
                      >
                        <Logs className="h-3.5 w-3.5" />
                        LOGS
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => void runContainerAction('restart', onRestartContainer, selectedContainer.id)}
                        disabled={!onRestartContainer || detailActionBusy}
                        title="Restart"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-8 p-6">
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <Activity className="h-3.5 w-3.5" />
                        General Information
                      </div>
                      <div className="grid grid-cols-2 gap-6 rounded-xl border border-border/40 bg-muted/20 p-4">
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                            <Hash className="h-3 w-3" /> Container ID
                          </p>
                          <p className="break-all font-mono text-[11px] font-medium text-muted-foreground">
                            {selectedContainer.id.slice(0, 12)}...
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                            <Clock className="h-3 w-3" /> Created
                          </p>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {selectedContainer.createdAt || 'Unknown'}
                          </p>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                            <Activity className="h-3 w-3" /> Status
                          </p>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {selectedContainer.status || selectedContainer.state}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <TerminalIcon className="h-3.5 w-3.5" />
                        Execution Details
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Command</p>
                          <div className="rounded-md bg-background/50 p-2.5 font-mono text-[11px] text-muted-foreground/90 border border-border/20 break-all leading-relaxed">
                            {selectedContainer.command || 'No entrypoint specified'}
                          </div>
                        </div>
                      </div>
                    </section>

                    {(composeProject || composeService) && (
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          <Layers className="h-3.5 w-3.5" />
                          Docker Compose
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-xl border border-border/40 bg-muted/20 p-4">
                          {composeProject && (
                            <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                              <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/50">Project</span>
                              <span className="text-xs font-semibold">{composeProject}</span>
                            </div>
                          )}
                          {composeService && (
                            <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                              <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/50">Service</span>
                              <span className="text-xs font-semibold">{composeService}</span>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <Network className="h-3.5 w-3.5" />
                        Networking & Labels
                      </div>
                      <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Exposed Ports</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedContainer.ports.length > 0 ? (
                              selectedContainer.ports.map((port) => (
                                <Badge key={port} variant="secondary" className="h-6 px-2 text-[10px] font-mono border-border/40">
                                  {port}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] italic text-muted-foreground/50">No ports exposed</span>
                            )}
                          </div>
                        </div>

                        {selectedContainer.labels && selectedContainer.labels.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border/20">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Labels</p>
                            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-auto pr-1">
                              {selectedContainer.labels.map((label) => (
                                <Badge key={label} variant="outline" className="h-5 px-1.5 text-[9px] font-medium text-muted-foreground/70 bg-background/30">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </ScrollArea>

                <div className="mt-auto border-t border-border/60 bg-muted/30 px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedContainer.state === 'running' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 h-9 text-[11px] font-bold"
                          onClick={() => void runContainerAction('pause', onPauseContainer, selectedContainer.id)}
                          disabled={!onPauseContainer || detailActionBusy}
                        >
                          <Pause className="h-3.5 w-3.5" />
                          PAUSE
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 gap-1.5 h-9 text-[11px] font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                          onClick={() => void runContainerAction('stop', onStopContainer, selectedContainer.id)}
                          disabled={!onStopContainer || detailActionBusy}
                        >
                          <Square className="h-3.5 w-3.5" />
                          STOP
                        </Button>
                      </>
                    ) : selectedContainer.state === 'paused' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 h-9 text-[11px] font-bold"
                          onClick={() => void runContainerAction('unpause', onUnpauseContainer, selectedContainer.id)}
                          disabled={!onUnpauseContainer || detailActionBusy}
                        >
                          <Play className="h-3.5 w-3.5" />
                          RESUME
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 gap-1.5 h-9 text-[11px] font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                          onClick={() => void runContainerAction('stop', onStopContainer, selectedContainer.id)}
                          disabled={!onStopContainer || detailActionBusy}
                        >
                          <Square className="h-3.5 w-3.5" />
                          STOP
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 h-9 text-[11px] font-bold shadow-lg shadow-primary/20"
                        onClick={() => void runContainerAction('start', onStartContainer, selectedContainer.id)}
                        disabled={!onStartContainer || detailActionBusy}
                      >
                        <Power className="h-3.5 w-3.5" />
                        START CONTAINER
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-9 w-9 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                      onClick={() => openRemoveDialog([selectedContainer.id])}
                      disabled={!onRemoveContainer || detailActionBusy}
                      title="Remove container"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center opacity-30">
                <Box className="h-12 w-12" />
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest">No Selection</p>
                  <p className="text-xs">Select a container to view deep inspection</p>
                </div>
              </div>
            )}
          </div>
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
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Containers</DialogTitle>
            <DialogDescription>
              This will remove the selected container{removeTargets.length === 1 ? '' : 's'} from Docker.
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
