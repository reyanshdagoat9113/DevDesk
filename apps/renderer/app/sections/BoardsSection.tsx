import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock3,
  Copy,
  LayoutGrid,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { Editor, LANGUAGES, Tldraw, getSnapshot, loadSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'

import { cn } from '../../lib/utils'
import type { Board, BoardRestorePoint, BoardSnapshot, Project } from '../types'
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

const AUTOSAVE_DELAY_MS = 1000
const RESTORE_POINT_INTERVAL_MS = 5 * 60 * 1000

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type SnapshotPayload = {
  document: unknown
  session: unknown
}

const EMPTY_TLDRAW_TRANSLATION_URL = 'data:application/json,%7B%7D'

const LOCAL_TLDRAW_ASSET_URLS = {
  translations: Object.fromEntries(
    LANGUAGES.map(({ locale }) => [locale, EMPTY_TLDRAW_TRANSLATION_URL]),
  ) as Record<(typeof LANGUAGES)[number]['locale'], string>,
}

function createEmptySnapshot(boardId: string): BoardSnapshot {
  return {
    boardId,
    document: {},
    session: {},
    savedAt: new Date(0).toISOString(),
  }
}

function formatTimestamp(value?: string) {
  if (!value) {
    return 'Never'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function BoardCanvas({
  boardId,
  snapshot,
  onSnapshotChange,
}: {
  boardId: string
  snapshot: BoardSnapshot
  onSnapshotChange: (snapshot: SnapshotPayload) => void
}) {
  const isHydratingRef = useRef(true)

  const handleMount = useCallback(
    (editor: Editor) => {
      isHydratingRef.current = true
      loadSnapshot(editor.store, {
        document: snapshot.document as never,
        session: snapshot.session as never,
      } as never)
      queueMicrotask(() => {
        isHydratingRef.current = false
      })

      const unsubscribe = (editor.store as { listen: (listener: () => void, filters?: unknown) => () => void }).listen(
        () => {
          if (isHydratingRef.current) {
            return
          }

          const nextSnapshot = getSnapshot(editor.store) as { document: unknown; session: unknown }
          onSnapshotChange({
            document: nextSnapshot.document ?? {},
            session: nextSnapshot.session ?? {},
          })
        },
        { source: 'user' },
      )

      return () => {
        unsubscribe?.()
      }
    },
    [onSnapshotChange, snapshot.document, snapshot.session],
  )

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-[1.25rem] border border-border/40 bg-black/30 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <Tldraw key={`${boardId}:${snapshot.savedAt}`} assetUrls={LOCAL_TLDRAW_ASSET_URLS} onMount={handleMount} />
    </div>
  )
}

export function BoardsSection({
  projects,
  isLoading,
  error,
}: {
  projects: Project[]
  isLoading?: boolean
  error?: string | null
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null)
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [boardSnapshot, setBoardSnapshot] = useState<BoardSnapshot | null>(null)
  const [restorePoints, setRestorePoints] = useState<BoardRestorePoint[]>([])
  const [isBoardsLoading, setIsBoardsLoading] = useState(false)
  const [isBoardLoading, setIsBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<Board | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)

  const selectedBoardIdRef = useRef<string | null>(null)
  const selectedProjectIdRef = useRef<string | null>(selectedProjectId)
  const pendingSnapshotRef = useRef<SnapshotPayload | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const lastRestorePointAtRef = useRef<string | null>(null)

  useEffect(() => {
    selectedBoardIdRef.current = selectedBoardId
  }, [selectedBoardId])

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId
  }, [selectedProjectId])

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null)
      return
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  const selectedProject = useMemo(() => {
    if (!projects.length) {
      return null
    }

    return projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  }, [projects, selectedProjectId])

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  )

  const syncBoardInList = useCallback((nextBoard: Board) => {
    setBoards((previous) => {
      const existingIndex = previous.findIndex((board) => board.id === nextBoard.id)
      if (existingIndex === -1) {
        return [nextBoard, ...previous]
      }

      const clone = [...previous]
      clone[existingIndex] = nextBoard
      return clone.sort((a, b) => {
        const left = a.lastOpenedAt ?? a.updatedAt
        const right = b.lastOpenedAt ?? b.updatedAt
        return right.localeCompare(left)
      })
    })
  }, [])

  const loadBoards = useCallback(async (projectId: string) => {
    setIsBoardsLoading(true)
    setBoardError(null)
    try {
      const nextBoards = await window.electronAPI.getBoards(projectId)
      setBoards(nextBoards)
      setSelectedBoardId((current) => {
        if (current && nextBoards.some((board) => board.id === current)) {
          return current
        }
        return nextBoards[0]?.id ?? null
      })
    } catch (loadBoardsError) {
      setBoards([])
      setSelectedBoardId(null)
      setBoardSnapshot(null)
      setRestorePoints([])
      setBoardError(loadBoardsError instanceof Error ? loadBoardsError.message : 'Failed to load boards.')
    } finally {
      setIsBoardsLoading(false)
    }
  }, [])

  const refreshRestorePoints = useCallback(async (boardId: string) => {
    const nextRestorePoints = await window.electronAPI.getBoardRestorePoints(boardId)
    setRestorePoints(nextRestorePoints)
    lastRestorePointAtRef.current = nextRestorePoints[0]?.createdAt ?? null
    return nextRestorePoints
  }, [])

  const loadBoardState = useCallback(
    async (boardId: string) => {
      setIsBoardLoading(true)
      setBoardError(null)
      try {
        const [snapshot, nextRestorePoints] = await Promise.all([
          window.electronAPI.getBoardSnapshot(boardId),
          window.electronAPI.getBoardRestorePoints(boardId),
        ])
        setBoardSnapshot(snapshot ?? createEmptySnapshot(boardId))
        setRestorePoints(nextRestorePoints)
        lastRestorePointAtRef.current = nextRestorePoints[0]?.createdAt ?? null
        setBoards((previous) =>
          previous.map((board) =>
            board.id === boardId
              ? {
                  ...board,
                  lastOpenedAt: snapshot?.savedAt ?? board.lastOpenedAt,
                }
              : board,
          ),
        )
      } catch (loadBoardError) {
        setBoardSnapshot(null)
        setRestorePoints([])
        setBoardError(loadBoardError instanceof Error ? loadBoardError.message : 'Failed to load board.')
      } finally {
        setIsBoardLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!selectedProjectId) {
      setBoards([])
      setSelectedBoardId(null)
      return
    }

    void loadBoards(selectedProjectId)
  }, [loadBoards, selectedProjectId])

  useEffect(() => {
    if (!selectedBoardId) {
      setBoardSnapshot(null)
      setRestorePoints([])
      setRenameDraft('')
      return
    }

    const board = boards.find((entry) => entry.id === selectedBoardId)
    setRenameDraft(board?.name ?? '')
    void loadBoardState(selectedBoardId)
  }, [boards, loadBoardState, selectedBoardId])

  const flushPendingSave = useCallback(async () => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    const snapshot = pendingSnapshotRef.current
    const boardId = selectedBoardIdRef.current
    if (!snapshot || !boardId) {
      return
    }

    pendingSnapshotRef.current = null
    setSaveState('saving')
    setSaveError(null)

    try {
      const savedSnapshot = await window.electronAPI.saveBoardSnapshot(boardId, snapshot)
      setBoardSnapshot(savedSnapshot)
      setSaveState('saved')
      const currentProjectId = selectedProjectIdRef.current ?? selectedProject?.id ?? null
      if (currentProjectId) {
        const updatedBoards = await window.electronAPI.getBoards(currentProjectId)
        setBoards(updatedBoards)
      }

      const lastRestorePointAt = lastRestorePointAtRef.current ? new Date(lastRestorePointAtRef.current).getTime() : 0
      const savedAtTime = new Date(savedSnapshot.savedAt).getTime()
      if (!lastRestorePointAt || savedAtTime - lastRestorePointAt >= RESTORE_POINT_INTERVAL_MS) {
        const restorePoint = await window.electronAPI.createBoardRestorePoint(boardId, {
          document: snapshot.document,
          session: snapshot.session,
          reason: 'Autosave checkpoint',
        })
        lastRestorePointAtRef.current = restorePoint.createdAt
        setRestorePoints((previous) => [restorePoint, ...previous].slice(0, 20))
      }
    } catch (persistError) {
      setSaveState('error')
      setSaveError(persistError instanceof Error ? persistError.message : 'Failed to save board.')
    }
  }, [selectedProject])

  useEffect(() => {
    return () => {
      void flushPendingSave()
    }
  }, [flushPendingSave])

  const handleProjectSelect = useCallback(
    async (projectId: string) => {
      await flushPendingSave()
      setSelectedProjectId(projectId)
    },
    [flushPendingSave],
  )

  const handleBoardSelect = useCallback(
    async (boardId: string) => {
      if (boardId === selectedBoardIdRef.current) {
        return
      }

      await flushPendingSave()
      setSelectedBoardId(boardId)
    },
    [flushPendingSave],
  )

  const handleCreateBoard = useCallback(async () => {
    if (!selectedProjectId) {
      return
    }

    setBoardError(null)
    try {
      const createdBoard = await window.electronAPI.createBoard(selectedProjectId)
      syncBoardInList(createdBoard)
      setSelectedBoardId(createdBoard.id)
    } catch (createError) {
      setBoardError(createError instanceof Error ? createError.message : 'Failed to create board.')
    }
  }, [selectedProjectId, syncBoardInList])

  const handleDuplicateBoard = useCallback(
    async (boardId: string) => {
      setBoardError(null)
      try {
        const duplicatedBoard = await window.electronAPI.duplicateBoard(boardId)
        syncBoardInList(duplicatedBoard)
        setSelectedBoardId(duplicatedBoard.id)
      } catch (duplicateError) {
        setBoardError(duplicateError instanceof Error ? duplicateError.message : 'Failed to duplicate board.')
      }
    },
    [syncBoardInList],
  )

  const handleRenameBoard = useCallback(async () => {
    if (!selectedBoard || !renameDraft.trim() || renameDraft.trim() === selectedBoard.name) {
      return
    }

    setIsRenaming(true)
    setBoardError(null)
    try {
      const renamedBoard = await window.electronAPI.renameBoard(selectedBoard.id, renameDraft.trim())
      syncBoardInList(renamedBoard)
    } catch (renameError) {
      setBoardError(renameError instanceof Error ? renameError.message : 'Failed to rename board.')
    } finally {
      setIsRenaming(false)
    }
  }, [renameDraft, selectedBoard, syncBoardInList])

  const handleDeleteBoard = useCallback(async () => {
    if (!deleteCandidate) {
      return
    }

    setBoardError(null)
    try {
      await window.electronAPI.deleteBoard(deleteCandidate.id)
      setBoards((previous) => {
        const nextBoards = previous.filter((board) => board.id !== deleteCandidate.id)
        setSelectedBoardId((current) => {
          if (current !== deleteCandidate.id) {
            return current
          }
          return nextBoards[0]?.id ?? null
        })
        return nextBoards
      })
      setDeleteCandidate(null)
    } catch (deleteError) {
      setBoardError(deleteError instanceof Error ? deleteError.message : 'Failed to delete board.')
    }
  }, [deleteCandidate])

  const handleRestoreBoard = useCallback(
    async (restorePointId: string) => {
      if (!selectedBoard) {
        return
      }

      setBoardError(null)
      try {
        const restoredSnapshot = await window.electronAPI.restoreBoardSnapshot(selectedBoard.id, restorePointId)
        setBoardSnapshot(restoredSnapshot)
        await refreshRestorePoints(selectedBoard.id)
        setRestoreDialogOpen(false)
        setSaveState('saved')
      } catch (restoreError) {
        setBoardError(restoreError instanceof Error ? restoreError.message : 'Failed to restore board.')
      }
    },
    [refreshRestorePoints, selectedBoard],
  )

  const handleDuplicateRestorePoint = useCallback(
    async (restorePoint: BoardRestorePoint) => {
      if (!selectedProjectId) {
        return
      }

      setBoardError(null)
      try {
        const createdBoard = await window.electronAPI.createBoard(selectedProjectId, `${selectedBoard?.name ?? 'Board'} Snapshot`)
        await window.electronAPI.saveBoardSnapshot(createdBoard.id, {
          document: restorePoint.document,
          session: restorePoint.session,
        })
        await window.electronAPI.createBoardRestorePoint(createdBoard.id, {
          document: restorePoint.document,
          session: restorePoint.session,
          reason: `Cloned from ${formatTimestamp(restorePoint.createdAt)}`,
        })
        syncBoardInList(createdBoard)
        setSelectedBoardId(createdBoard.id)
        setRestoreDialogOpen(false)
      } catch (duplicateError) {
        setBoardError(duplicateError instanceof Error ? duplicateError.message : 'Failed to duplicate restore point.')
      }
    },
    [selectedBoard?.name, selectedProjectId, syncBoardInList],
  )

  const scheduleAutosave = useCallback(
    (snapshot: SnapshotPayload) => {
      pendingSnapshotRef.current = snapshot
      setSaveState('saving')
      setSaveError(null)

      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
      }

      autosaveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave()
      }, AUTOSAVE_DELAY_MS)
    },
    [flushPendingSave],
  )

  const statusLabel = useMemo(() => {
    if (saveState === 'error') {
      return saveError ?? 'Save failed'
    }
    if (saveState === 'saving') {
      return 'Autosaving changes...'
    }
    if (saveState === 'saved' && boardSnapshot) {
      return `Saved ${formatTimestamp(boardSnapshot.savedAt)}`
    }
    return 'Ready'
  }, [boardSnapshot, saveError, saveState])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Preparing project boards...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-xl border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle>Boards are unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="grid h-full min-h-0 gap-5 p-4 lg:grid-cols-[260px_320px_minmax(0,1fr)] lg:p-6 xl:gap-6 xl:p-8">
        <Card className="min-h-0 overflow-hidden border-border/40 bg-card/50 shadow-lg">
          <CardHeader className="border-b border-border/30 bg-transparent px-4 py-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Projects</CardTitle>
            <CardDescription className="text-xs text-muted-foreground/70">
              Boards stay attached to the same project workspace as your commands and notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 space-y-2 overflow-auto px-3 py-3">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                Add a project before creating a board.
              </div>
            ) : (
              projects.map((project) => {
                const isActive = project.id === selectedProject?.id
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => void handleProjectSelect(project.id)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                      isActive
                        ? 'border-primary/30 bg-primary/10 shadow-[0_20px_40px_rgba(255,255,255,0.04)]'
                        : 'border-border/20 bg-muted/10 hover:border-border/60 hover:bg-muted/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{project.path}</p>
                      </div>
                      {isActive ? <Badge className="shrink-0 bg-primary/15 text-primary">Live</Badge> : null}
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden border-border/40 bg-card/50 shadow-lg">
          <CardHeader className="border-b border-border/30 bg-transparent px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Boards</CardTitle>
                <CardDescription className="mt-1.5 text-xs text-muted-foreground/70">
                  Multiple canvases per project.
                </CardDescription>
              </div>
              <Button size="sm" className="w-full shrink-0 xl:w-auto" onClick={() => void handleCreateBoard()} disabled={!selectedProjectId}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New board
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto px-3 py-3">
            {isBoardsLoading ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                Loading boards...
              </div>
            ) : boards.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/20 px-6 text-center">
                <LayoutGrid className="h-9 w-9 text-muted-foreground/40" />
                <p className="mt-4 text-sm font-semibold">No boards in this project yet.</p>
                <p className="mt-2 max-w-[220px] text-xs text-muted-foreground/70">
                  Start with a canvas for architecture, investigation notes, or release planning.
                </p>
                <Button className="mt-5" size="sm" onClick={() => void handleCreateBoard()} disabled={!selectedProjectId}>
                  <Plus className="h-3.5 w-3.5" />
                  Create the first board
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {boards.map((board) => {
                  const isActive = board.id === selectedBoard?.id
                  return (
                    <div
                      key={board.id}
                      className={cn(
                        'rounded-2xl border px-4 py-3 transition-all duration-200',
                        isActive
                          ? 'border-primary/30 bg-primary/10 shadow-[0_16px_32px_rgba(255,255,255,0.04)]'
                          : 'border-border/20 bg-muted/10 hover:border-border/50 hover:bg-muted/15',
                      )}
                    >
                      <button type="button" className="w-full text-left" onClick={() => void handleBoardSelect(board.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{board.name}</p>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
                              Updated {formatTimestamp(board.updatedAt)}
                            </p>
                          </div>
                          {isActive ? <Badge className="shrink-0 bg-primary/15 text-primary">Open</Badge> : null}
                        </div>
                      </button>
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => void handleDuplicateBoard(board.id)}>
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteCandidate(board)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>


        <div className="min-h-0 overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-4 shadow-2xl lg:p-5">
          {!selectedProject ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/30 bg-black/20 text-sm text-muted-foreground">
              Select a project to open its boards.
            </div>
          ) : !selectedBoard ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-card/30 px-8 text-center shadow-sm">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <h3 className="mt-5 text-lg font-semibold text-foreground">Canvas space for {selectedProject.name}</h3>
              <p className="mt-3 max-w-md text-sm text-muted-foreground/75">
                Create a board to sketch workflows, map systems, or keep messy thinking beside the codebase it belongs to.
              </p>
              <Button className="mt-6" onClick={() => void handleCreateBoard()}>
                <Plus className="h-4 w-4" />
                Create board
              </Button>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.25rem] border border-border/30 bg-black/25 px-5 py-4 backdrop-blur-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
                    <StickyNote className="h-3.5 w-3.5" />
                    Visual workspace
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => void handleRenameBoard()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleRenameBoard()
                        }
                      }}
                      disabled={isRenaming}
                      className="h-11 w-[280px] border-border/40 bg-background/70 text-base font-semibold"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRenameBoard()}
                      disabled={isRenaming || !selectedBoard || !renameDraft.trim() || renameDraft.trim() === selectedBoard.name}
                    >
                      {isRenaming ? 'Renaming...' : 'Rename'}
                    </Button>
                    <Badge variant="secondary" className="h-8 rounded-full px-3">
                      {restorePoints.length} restore point{restorePoints.length === 1 ? '' : 's'}
                    </Badge>
                    <Badge variant="secondary" className="h-8 rounded-full px-3">
                      {selectedProject.name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground/75">
                    Autosaves every moment that matters. Restore points protect the state before destructive actions and on timed checkpoints.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRestoreDialogOpen(true)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore points
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleDuplicateBoard(selectedBoard.id)}>
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteCandidate(selectedBoard)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/20 bg-black/20 px-4 py-3 text-sm text-muted-foreground/80">
                <div className="flex items-center gap-2">
                  {saveState === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                  <span>{statusLabel}</span>
                </div>
                {selectedBoard.lastOpenedAt ? (
                  <span className="text-xs text-muted-foreground/60">Opened {formatTimestamp(selectedBoard.lastOpenedAt)}</span>
                ) : null}
              </div>

              {boardError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {boardError}
                </div>
              ) : null}

              {isBoardLoading || !boardSnapshot ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border/20 bg-black/20 text-sm text-muted-foreground">
                  Loading board canvas...
                </div>
              ) : (
                <BoardCanvas boardId={selectedBoard.id} snapshot={boardSnapshot} onSnapshotChange={scheduleAutosave} />
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(deleteCandidate)} onOpenChange={(open) => (!open ? setDeleteCandidate(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
            <DialogDescription>
              {deleteCandidate
                ? `Delete ${deleteCandidate.name}? DevDesk will keep a restore point before removing it from the project.`
                : 'Delete this board.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteBoard()}>
              Delete board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restore points</DialogTitle>
            <DialogDescription>
              Rewind the active board or branch an earlier snapshot into a fresh board.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {restorePoints.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/30 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                No restore points yet.
              </div>
            ) : (
              restorePoints.map((restorePoint) => (
                <div key={restorePoint.id} className="rounded-2xl border border-border/30 bg-muted/10 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{restorePoint.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Created {formatTimestamp(restorePoint.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void handleDuplicateRestorePoint(restorePoint)}>
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate as board
                      </Button>
                      <Button size="sm" onClick={() => void handleRestoreBoard(restorePoint.id)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
