import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { cn } from '@/lib/utils'
import { TerminalExitOverlay } from './TerminalExitOverlay'

import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  terminalId: string
  onClose?: () => void
  className?: string
}

const DARK_THEME = {
  background: '#111318',
  foreground: '#eef1f5',
  cursor: '#4fb3ff',
  selectionBackground: 'rgba(79, 179, 255, 0.3)',
}

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1a1a2e',
  cursor: '#4fb3ff',
  selectionBackground: 'rgba(79, 179, 255, 0.3)',
}

function getThemeOptions(isDark: boolean) {
  const theme = isDark ? DARK_THEME : LIGHT_THEME
  return {
    theme: {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: theme.selectionBackground,
    },
  }
}

function detectTheme(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function Terminal({ terminalId, onClose, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const [exitState, setExitState] = useState<{ code?: number | null; error?: string | null } | null>(null)

  const handleCopy = useCallback(async () => {
    const xterm = xtermRef.current
    if (xterm?.hasSelection()) {
      await navigator.clipboard.writeText(xterm.getSelection())
    }
  }, [])

  const handlePaste = useCallback(async () => {
    const xterm = xtermRef.current
    if (!xterm) return
    try {
      const text = await navigator.clipboard.readText()
      xterm.paste(text)
    } catch {
      // Clipboard access denied or unavailable
    }
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      handleCopy()
    },
    [handleCopy],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        handleCopy()
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        handlePaste()
      }
    },
    [handleCopy, handlePaste],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const isDark = detectTheme()
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
      allowProposedApi: true,
      scrollback: 5000,
      ...getThemeOptions(isDark),
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.loadAddon(searchAddon)

    xterm.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    const unsubTerminalData = window.electronAPI.onTerminalData((payload) => {
      if (payload.terminalId === terminalId) {
        xterm.write(payload.data)
      }
    })

    const unsubTerminalExit = window.electronAPI.onTerminalExit((payload) => {
      if (payload.terminalId === terminalId) {
        setExitState({ code: payload.code })
      }
    })

    const unsubTerminalError = window.electronAPI.onTerminalError((payload) => {
      if (payload.terminalId === terminalId) {
        setExitState({ error: payload.error })
      }
    })

    const dataDisposable = xterm.onData((data) => {
      window.electronAPI.writeTerminal(terminalId, data)
    })

    let rafId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        fitAddon.fit()
        const { cols, rows } = xterm
        window.electronAPI.resizeTerminal(terminalId, cols, rows)
      })
    })

    resizeObserver.observe(containerRef.current)

    const mutationObserver = new MutationObserver(() => {
      const currentDark = detectTheme()
      xterm.options = { ...xterm.options, ...getThemeOptions(currentDark).theme }
    })

    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    cleanupRef.current = [
      () => resizeObserver.disconnect(),
      () => mutationObserver.disconnect(),
      () => dataDisposable.dispose(),
      unsubTerminalData,
      unsubTerminalExit,
      unsubTerminalError,
    ]

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      xterm.dispose()
      window.electronAPI.closeTerminal(terminalId)
    }
  }, [terminalId])

  const handleDismiss = useCallback(() => {
    setExitState(null)
    onClose?.()
  }, [onClose])

  return (
    <div
      className={cn('relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border/50', className)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div ref={containerRef} className="flex-1 overflow-hidden" />
      {exitState && (
        <TerminalExitOverlay
          exitCode={exitState.code}
          error={exitState.error}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  )
}
