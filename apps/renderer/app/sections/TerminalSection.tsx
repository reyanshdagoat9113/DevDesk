import type { Project, TerminalSessionState } from '../types'
import { TerminalTabs } from '../components/Terminal'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import { cn } from '@/lib/utils'

interface TerminalSectionProps {
  sessions: TerminalSessionState[]
  activeId: string | null
  onSelectTab: (terminalId: string) => void
  onCloseTab: (terminalId: string) => void
  onCreateSession: (projectId?: string) => void
  onRenameTab?: (terminalId: string, newLabel: string) => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  projects: Project[]
  error?: string | null
}

export function TerminalSection({ sessions, activeId, onSelectTab, onCloseTab, onCreateSession, onRenameTab, onToggleFullscreen, isFullscreen, projects, error }: TerminalSectionProps) {
  return (
    <div className={cn('flex h-full flex-col', isFullscreen && 'fixed inset-0 z-50 bg-background')}>
      {error ? (
        <div className="shrink-0 p-4 pb-0">
          <Alert variant="destructive">
            <AlertTitle>Terminal error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        <TerminalTabs
          sessions={sessions}
          activeId={activeId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCreateSession={onCreateSession}
          onRenameTab={onRenameTab}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
          projects={projects}
        />
      </div>
    </div>
  )
}
