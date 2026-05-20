import { useCallback } from 'react'
import { Plus, X, Monitor } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '@/lib/utils'
import { Terminal } from './Terminal'
import type { Project, TerminalSessionState } from '../../types'

interface TerminalTabsProps {
  sessions: TerminalSessionState[]
  activeId: string | null
  onSelectTab: (terminalId: string) => void
  onCloseTab: (terminalId: string) => void
  onCreateSession: (projectId?: string) => void
  projects: Project[]
}

export function TerminalTabs({ sessions, activeId, onSelectTab, onCloseTab, onCreateSession }: TerminalTabsProps) {
  const handleClose = useCallback((e: React.MouseEvent, terminalId: string) => {
    e.stopPropagation()
    onCloseTab(terminalId)
  }, [onCloseTab])

  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Monitor className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No terminal sessions open</p>
          <Button variant="outline" size="sm" onClick={() => onCreateSession()}>
            <Plus className="mr-2 h-4 w-4" /> New Terminal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex h-9 items-center gap-0.5 border-b border-border/40 bg-muted/20 px-2">
        {sessions.map((session) => {
          const isActive = session.id === activeId
          return (
            <button
              key={session.id}
              onClick={() => onSelectTab(session.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              <span className="max-w-[160px] truncate">{session.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleClose(e, session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onCloseTab(session.id)
                  }
                }}
                className="flex h-5 w-5 items-center justify-center rounded opacity-50 hover:bg-muted-foreground/20 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          )
        })}
        <button
          onClick={() => onCreateSession()}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          title="New terminal"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Terminal Viewport */}
      <div className="relative flex-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'absolute inset-0 p-2',
              session.id !== activeId && 'hidden'
            )}
          >
            <Terminal
              terminalId={session.id}
              onClose={() => onCloseTab(session.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
