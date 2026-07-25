import { useCallback, useState } from 'react'
import { Check, Copy, Loader2, Play, XCircle } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from './ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog'

interface RunnableBlockProps {
  code: string
  language?: string
  projectId?: string
  runnable: boolean
}

type RunState = 'idle' | 'running' | 'started' | 'error'
type CopyState = 'idle' | 'copied'

export function RunnableBlock({ code, language, projectId, runnable }: RunnableBlockProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [runState, setRunState] = useState<RunState>('idle')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const trimmedCode = code.trim()
  const canRun = runnable && Boolean(projectId) && Boolean(trimmedCode)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setMessage('Copy failed.')
    }
  }, [code])

  const handleRun = useCallback(async () => {
    if (!projectId || !trimmedCode) {
      return
    }

    setRunState('running')
    setMessage(null)

    try {
      const result = await window.electronAPI.runAdhocCommand(projectId, trimmedCode)
      if (result.status === 'needs-input') {
        setRunState('error')
        setMessage('This wiki command has unresolved variables. Save it as a command to provide inputs.')
        return
      }

      setRunState('started')
      setMessage('runId' in result ? `Started run ${result.runId.slice(0, 8)}.` : 'Command started.')
      setConfirmOpen(false)
    } catch (error) {
      setRunState('error')
      setMessage(error instanceof Error ? error.message : 'Failed to run command.')
    }
  }, [projectId, trimmedCode])

  return (
    <div className="not-prose my-3 overflow-hidden rounded-lg border border-border/50 bg-[#1e1e1e]">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border/30 bg-muted/20 px-3 py-2">
        <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {language || 'text'}
          {runnable ? ':run' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {message && (
            <span className="hidden max-w-[220px] truncate text-[10px] text-muted-foreground sm:inline">
              {message}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 gap-1.5 px-2 text-[10px]"
            onClick={() => void handleCopy()}
          >
            {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          {runnable && (
            <Button
              type="button"
              size="xs"
              className="h-7 gap-1.5 px-2 text-[10px]"
              disabled={!canRun || runState === 'running'}
              onClick={() => setConfirmOpen(true)}
            >
              {runState === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
          )}
        </div>
      </div>

      <SyntaxHighlighter
        PreTag="div"
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: 0, background: '#1e1e1e' }}
      >
        {code.replace(/\n$/, '')}
      </SyntaxHighlighter>

      {runnable && !projectId && (
        <div className="flex items-center gap-2 border-t border-border/30 px-3 py-2 text-[11px] text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" />
          Select a project before running wiki commands.
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run wiki command?</DialogTitle>
            <DialogDescription>
              This command will execute in the selected project context and appear in run history.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-72 overflow-auto rounded-md border border-border/50 bg-background p-3 font-mono text-xs text-foreground">
            {trimmedCode}
          </pre>
          {message && runState === 'error' && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              {message}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={runState === 'running'}>
              Cancel
            </Button>
            <Button onClick={() => void handleRun()} disabled={!canRun || runState === 'running'}>
              {runState === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
              Run Command
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
