import type { Project, TerminalSessionState } from '../types'
import { TerminalTabs } from '../components/Terminal'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'

interface TerminalSectionProps {
  sessions: TerminalSessionState[]
  activeId: string | null
  onSelectTab: (terminalId: string) => void
  onCloseTab: (terminalId: string) => void
  onCreateSession: (projectId?: string) => void
  projects: Project[]
  error?: string | null
}

export function TerminalSection({ sessions, activeId, onSelectTab, onCloseTab, onCreateSession, projects, error }: TerminalSectionProps) {
  return (
    <div className="flex h-full flex-col">
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
          projects={projects}
        />
      </div>
    </div>
  )
}
