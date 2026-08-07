import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { Copy, Plus, X, ZoomIn, ZoomOut, RotateCcw, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TerminalExitOverlay } from './TerminalExitOverlay'

import '@xterm/xterm/css/xterm.css'

const BASE_FONT_SIZE = 14
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 32

interface TerminalProps {
  terminalId: string
  onClose?: () => void
  onNewTab?: () => void
  onRequestRename?: () => void
  className?: string
  isVisible?: boolean
}

function getThemeColor(variable: string, alpha?: number) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value ? `hsl(${value}${alpha === undefined ? '' : ` / ${alpha}`})` : `hsl(var(${variable})${alpha === undefined ? '' : ` / ${alpha}`})`
}

function getThemeOptions() {
  return {
    theme: {
      background: getThemeColor('--terminal-surface'),
      foreground: getThemeColor('--terminal-foreground'),
      cursor: getThemeColor('--terminal-cursor'),
      selectionBackground: getThemeColor('--terminal-selection', 0.3),
    },
  }
}

function getZoomPercent(zoomDelta: number) {
  return Math.round(((BASE_FONT_SIZE + zoomDelta) / BASE_FONT_SIZE) * 100)
}

export function Terminal({ terminalId, onClose, onNewTab, onRequestRename, className, isVisible = true }: TerminalProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const [exitState, setExitState] = useState<{ code?: number | null; error?: string | null } | null>(null)

  const visibleRef = useRef(isVisible)
  const writeBufferRef = useRef('')
  const flushRafRef = useRef<number | null>(null)

  // Zoom state persisted per terminal instance
  const zoomRef = useRef(0)
  const [zoomDisplay, setZoomDisplay] = useState(100)

  const onCloseRef = useRef(onClose)
  const onNewTabRef = useRef(onNewTab)
  onCloseRef.current = onClose
  onNewTabRef.current = onNewTab

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuItemsRef = useRef<Array<HTMLButtonElement | null>>([])
  const restoreMenuFocusRef = useRef<HTMLElement | null>(null)

  const updateZoomDisplay = useCallback(() => {
    setZoomDisplay(getZoomPercent(zoomRef.current))
  }, [])

  const applyZoom = useCallback((delta: number) => {
    const xterm = xtermRef.current
    const fitAddon = fitAddonRef.current
    if (!xterm || !fitAddon) return

    zoomRef.current += delta
    const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE + zoomRef.current))
    xterm.options.fontSize = newSize
    fitAddon.fit()
    const { cols, rows } = xterm
    window.electronAPI.resizeTerminal(terminalId, cols, rows)
    updateZoomDisplay()
  }, [terminalId, updateZoomDisplay])

  const scheduleFlush = useCallback((xterm: XTerm) => {
    if (flushRafRef.current !== null) return
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null
      const buffer = writeBufferRef.current
      if (buffer) {
        writeBufferRef.current = ''
        try {
          xterm.write(buffer)
        } catch {
          // xterm may be disposed
        }
      }
    })
  }, [])

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    const target = restoreMenuFocusRef.current
    if (target?.isConnected) {
      target.focus()
    } else {
      rootRef.current?.focus()
    }
  }, [])

  // Move focus into the menu when it opens and restore it to the terminal when it closes.
  useEffect(() => {
    if (!contextMenu) return
    menuItemsRef.current.find((item) => item && !item.disabled)?.focus()

    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeContextMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [closeContextMenu, contextMenu])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      restoreMenuFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : rootRef.current
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(8, Math.min(e.clientX - rect.left, Math.max(8, rect.width - 196)))
      const y = Math.max(8, Math.min(e.clientY - rect.top, Math.max(8, rect.height - 240)))
      setContextMenu({ x, y })
    },
    [],
  )

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledIndexes = menuItemsRef.current
      .map((item, index) => (item && !item.disabled ? index : null))
      .filter((index): index is number => index !== null)
    const currentPosition = enabledIndexes.findIndex((index) => menuItemsRef.current[index] === document.activeElement)
    let nextPosition: number | null = null
    if (e.key === 'ArrowDown') nextPosition = currentPosition < enabledIndexes.length - 1 ? currentPosition + 1 : 0
    if (e.key === 'ArrowUp') nextPosition = currentPosition > 0 ? currentPosition - 1 : enabledIndexes.length - 1
    if (e.key === 'Home') nextPosition = 0
    if (e.key === 'End') nextPosition = enabledIndexes.length - 1
    if (nextPosition !== null && enabledIndexes.length > 0) {
      e.preventDefault()
      menuItemsRef.current[enabledIndexes[nextPosition]]?.focus()
    }
  }, [])

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
    visibleRef.current = isVisible
    const xterm = xtermRef.current
    if (xterm && isVisible && writeBufferRef.current) {
      scheduleFlush(xterm)
    }
  }, [isVisible, scheduleFlush])

  useEffect(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      fontSize: BASE_FONT_SIZE,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
      allowProposedApi: true,
      scrollback: 5000,
      minimumContrastRatio: 4.5,
      ...getThemeOptions(),
    })

    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Intercept terminal shortcuts before the shell sees them
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 't') {
          e.preventDefault()
          onNewTabRef.current?.()
          return false
        }
        if (key === 'w') {
          e.preventDefault()
          onCloseRef.current?.()
          return false
        }
        if (key === '+' || key === '=') {
          e.preventDefault()
          applyZoom(1)
          return false
        }
        if (key === '-') {
          e.preventDefault()
          applyZoom(-1)
          return false
        }
        if (key === '0') {
          e.preventDefault()
          zoomRef.current = 0
          applyZoom(0)
          return false
        }
      }
      return true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.loadAddon(searchAddon)

    // Load WebGL renderer for much faster scrolling and large output
    const webglAddon = new WebglAddon()
    webglAddon.onContextLoss(() => {
      // Dispose the addon so xterm falls back to the DOM renderer gracefully
      try {
        webglAddon.dispose()
      } catch {
        // ignore
      }
    })
    xterm.loadAddon(webglAddon)

    xterm.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    const unsubTerminalData = window.electronAPI.onTerminalData((payload) => {
      if (payload.terminalId !== terminalId) return
      writeBufferRef.current += payload.data
      if (visibleRef.current) {
        scheduleFlush(xterm)
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

    let resizeRafId: number | null = null
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (resizeRafId !== null) return
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null
        fitAddon.fit()
      })
    })

    resizeObserver.observe(containerRef.current)

    // Debounce the IPC resize call so we don't spam the main process
    const observerCallback = () => {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      resizeDebounceTimer = setTimeout(() => {
        const { cols, rows } = xterm
        window.electronAPI.resizeTerminal(terminalId, cols, rows)
      }, 100)
    }
    xterm.onResize(observerCallback)

    const mutationObserver = new MutationObserver(() => {
      xterm.options.theme = getThemeOptions().theme
    })

    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    cleanupRef.current = [
      () => {
        if (resizeRafId !== null) {
          cancelAnimationFrame(resizeRafId)
          resizeRafId = null
        }
        if (resizeDebounceTimer) {
          clearTimeout(resizeDebounceTimer)
          resizeDebounceTimer = null
        }
        if (flushRafRef.current !== null) {
          cancelAnimationFrame(flushRafRef.current)
          flushRafRef.current = null
        }
        resizeObserver.disconnect()
      },
      () => mutationObserver.disconnect(),
      () => dataDisposable.dispose(),
      unsubTerminalData,
      unsubTerminalExit,
      unsubTerminalError,
    ]

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      xterm.dispose()
      // Do NOT close the terminal here — it should persist across tab switches.
      // Cleanup is handled by TerminalTabs onCloseTab or TerminalManager on app quit.
    }
  }, [terminalId, scheduleFlush, applyZoom])

  const handleDismiss = useCallback(() => {
    setExitState(null)
    onClose?.()
  }, [onClose])

  const hasSelection = xtermRef.current?.hasSelection() ?? false

  return (
    <div
      ref={rootRef}
      className={cn('relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border/50', className)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Terminal ${terminalId}`}
    >
      <div ref={containerRef} className="flex-1 overflow-hidden" />

      {/* Zoom level indicator */}
      {zoomDisplay !== 100 && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
          {zoomDisplay}%
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Terminal actions"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className="absolute z-50 max-h-[calc(100%-1rem)] min-w-[180px] max-w-[calc(100%-1rem)] overflow-y-auto rounded-md border border-border/50 bg-card p-1 shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[0] = element }}
            disabled={!hasSelection}
            onClick={() => {
              void handleCopy()
              closeContextMenu()
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors',
              hasSelection ? 'hover:bg-muted' : 'cursor-not-allowed opacity-40'
            )}
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[1] = element }}
            onClick={() => {
              void handlePaste()
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Type className="h-3 w-3" />
            Paste
          </button>

          <div className="my-1 h-px bg-border/50" />

          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[2] = element }}
            onClick={() => {
              onNewTab?.()
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            New Tab
          </button>
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[3] = element }}
            onClick={() => {
              onClose?.()
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-3 w-3" />
            Close Tab
          </button>
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[4] = element }}
            onClick={() => {
              onRequestRename?.()
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Type className="h-3 w-3" />
            Rename Tab
          </button>

          <div className="my-1 h-px bg-border/50" />

          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[5] = element }}
            onClick={() => {
              applyZoom(1)
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <ZoomIn className="h-3 w-3" />
            Zoom In
          </button>
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[6] = element }}
            onClick={() => {
              applyZoom(-1)
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <ZoomOut className="h-3 w-3" />
            Zoom Out
          </button>
          <button
            role="menuitem"
            ref={(element) => { menuItemsRef.current[7] = element }}
            onClick={() => {
              zoomRef.current = 0
              applyZoom(0)
              closeContextMenu()
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Zoom ({zoomDisplay}%)
          </button>
        </div>
      )}

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
