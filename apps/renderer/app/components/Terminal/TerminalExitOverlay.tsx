import { useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { Panel, PanelContent, PanelFooter, PanelHeader, PanelTitle } from '../ui/Panel'

interface TerminalExitOverlayProps {
  exitCode?: number | null
  error?: string | null
  onDismiss?: () => void
}

export function TerminalExitOverlay({ exitCode, error, onDismiss }: TerminalExitOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismissRef.current?.()
      }
    }
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [])

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      closeButtonRef.current?.focus()
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-auto bg-black/50 p-4 backdrop-blur-sm">
      <Panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-exit-title"
        aria-describedby="terminal-exit-description"
        onKeyDown={handleDialogKeyDown}
        className="max-h-full w-full max-w-md overflow-y-auto border-border/70 shadow-xl"
      >
        <PanelHeader className="pb-3">
          <PanelTitle id="terminal-exit-title" className="text-sm font-medium">
            {error ? 'Terminal Error' : 'Terminal Exited'}
          </PanelTitle>
        </PanelHeader>
        <PanelContent id="terminal-exit-description" className="space-y-2 text-sm">
          {exitCode !== undefined && exitCode !== null && (
            <p className="text-muted-foreground">
              Exit code: <span className="font-mono font-medium">{exitCode}</span>
            </p>
          )}
          {error && (
            <p className="break-all font-mono text-sm text-destructive">{error}</p>
          )}
        </PanelContent>
        <PanelFooter>
          <Button ref={closeButtonRef} variant="outline" size="sm" className="w-full" onClick={onDismiss}>
            Close
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  )
}
