import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Monitor, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/ActionButtons'
import { cn } from '@/lib/utils'
import { Terminal } from './Terminal'
import type { Project, TerminalSessionState } from '../../types'

interface TerminalTabsProps {
  sessions: TerminalSessionState[]
  activeId: string | null
  onSelectTab: (terminalId: string) => void
  onCloseTab: (terminalId: string) => void
  onCreateSession: (projectId?: string) => void
  onRenameTab?: (terminalId: string, newLabel: string) => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  projects: Project[]
}

export function TerminalTabs({ sessions, activeId, onSelectTab, onCloseTab, onCreateSession, onRenameTab, onToggleFullscreen, isFullscreen }: TerminalTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const previousEditingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    } else if (previousEditingIdRef.current) {
      tabButtonRefs.current[previousEditingIdRef.current]?.focus()
    }
    previousEditingIdRef.current = editingId
  }, [editingId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        onToggleFullscreen?.()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onToggleFullscreen])

  const startRename = useCallback((session: TerminalSessionState) => {
    setEditingId(session.id)
    setEditingValue(session.label)
  }, [])

  const commitRename = useCallback((sessionId: string) => {
    const trimmed = editingValue.trim()
    if (trimmed) {
      onRenameTab?.(sessionId, trimmed)
    }
    setEditingId(null)
    setEditingValue('')
  }, [editingValue, onRenameTab])

  const cancelRename = useCallback(() => {
    setEditingId(null)
    setEditingValue('')
  }, [])

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectTab(sessions[index].id)
      return
    }

    const navigation = {
      ArrowRight: (index + 1) % sessions.length,
      ArrowDown: (index + 1) % sessions.length,
      ArrowLeft: (index - 1 + sessions.length) % sessions.length,
      ArrowUp: (index - 1 + sessions.length) % sessions.length,
      Home: 0,
      End: sessions.length - 1,
    }[event.key]

    if (navigation !== undefined) {
      event.preventDefault()
      const nextId = sessions[navigation].id
      onSelectTab(nextId)
      tabButtonRefs.current[nextId]?.focus()
    }
  }, [onSelectTab, sessions])

  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Monitor aria-hidden="true" className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No terminal sessions open</p>
          <Button variant="outline" size="sm" onClick={() => onCreateSession()}>
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" /> New Terminal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Terminal sessions" aria-orientation="horizontal" className="flex min-h-9 flex-wrap items-center gap-0.5 border-b border-border/40 bg-muted/20 px-2 py-0.5">
        {sessions.map((session, index) => {
          const isActive = session.id === activeId
          const isEditing = editingId === session.id
          return (
            <div
              key={session.id}
              role="group"
              aria-label={`${session.label} terminal actions`}
              className={cn('flex h-8 items-center rounded-md text-xs font-medium transition-colors', isActive && 'bg-primary/10 text-primary ring-1 ring-primary/20')}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  aria-label={`Rename terminal ${session.label}`}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => commitRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename(session.id)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  className="mx-1 h-6 w-[min(9rem,calc(100vw-7rem))] rounded bg-background px-1 text-xs text-foreground outline-none ring-1 ring-primary/40"
                />
              ) : (
                <button
                  ref={(element) => { tabButtonRefs.current[session.id] = element }}
                  type="button"
                  role="tab"
                  id={`terminal-tab-${session.id}`}
                  aria-controls={`terminal-panel-${session.id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onSelectTab(session.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  onDoubleClick={() => startRename(session)}
                  title={session.label}
                  className={cn(
                    'flex h-8 min-w-0 max-w-[min(14rem,calc(100vw-7rem))] items-center px-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground',
                    isActive ? 'text-primary' : 'hover:bg-muted/40'
                  )}
                >
                  <span className="truncate">{session.label}</span>
                </button>
              )}
              <IconButton
                type="button"
                variant="ghost"
                aria-label={`Close terminal ${session.label}`}
                title={`Close terminal ${session.label}`}
                onClick={() => onCloseTab(session.id)}
                className="mr-0.5 h-6 w-6 shrink-0 rounded-sm p-0 opacity-60 hover:bg-muted-foreground/20 hover:opacity-100"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </IconButton>
            </div>
          )
        })}
        <IconButton
          type="button"
          variant="ghost"
          aria-label="New terminal"
          title="New terminal"
          onClick={() => onCreateSession()}
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        </IconButton>
        {onToggleFullscreen && (
          <IconButton
            type="button"
            variant="ghost"
            aria-label={isFullscreen ? 'Exit fullscreen terminal' : 'Enter fullscreen terminal'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={onToggleFullscreen}
            className="ml-auto h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" className="h-3.5 w-3.5" /> : <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />}
          </IconButton>
        )}
      </div>

      <div className="relative flex-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            role="tabpanel"
            id={`terminal-panel-${session.id}`}
            aria-labelledby={`terminal-tab-${session.id}`}
            aria-hidden={session.id !== activeId}
            className={cn('absolute inset-0 p-2', session.id !== activeId && 'hidden')}
          >
            <Terminal
              terminalId={session.id}
              onClose={() => onCloseTab(session.id)}
              onNewTab={() => onCreateSession()}
              onRequestRename={() => startRename(session)}
              isVisible={session.id === activeId}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
