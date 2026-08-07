import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Command, HelpCircle, Keyboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ToolbarButton } from '../components/ui/ActionButtons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { ProjectContextSwitcher, type ProjectContextOption } from '../components/ProjectContextSwitcher'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { cn } from '../../lib/utils'
import appIcon from '../../assets/devdesk-icon.png'

interface NavItem {
  value: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

export type SidebarMode = 'compact' | 'rail' | 'adaptive'

interface AppShellProps {
  navItems: ReadonlyArray<NavItem>
  activeNav: string
  onNavChange: (value: string) => void
  title: string
  titleDescription?: string
  action?: ReactNode
  themeToggle?: ReactNode
  settingsButton?: ReactNode
  projects?: ReadonlyArray<ProjectContextOption>
  activeProjectId?: string | null
  onProjectChange?: (projectId: string) => void
  sidebarMode?: SidebarMode
  children: ReactNode
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const update = () => setMatches(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [query])

  return matches
}

function getSidebarModeOverride(): SidebarMode | null {
  if (!import.meta.env.DEV) return null
  const value = new URLSearchParams(window.location.search).get('sidebar')
  return value === 'compact' || value === 'rail' || value === 'adaptive' ? value : null
}

export function AppShell({
  navItems,
  activeNav,
  onNavChange,
  title,
  titleDescription,
  action,
  themeToggle,
  settingsButton,
  projects = [],
  activeProjectId,
  onProjectChange,
  sidebarMode = 'rail',
  children,
}: AppShellProps) {
  const [sidebarOverride] = useState<SidebarMode | null>(() => getSidebarModeOverride())
  const requestedMode = sidebarOverride ?? sidebarMode
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => requestedMode !== 'rail')
  const isMediumViewport = useMediaQuery('(max-width: 1179px)')
  const isNarrowViewport = useMediaQuery('(max-width: 759px)')
  const effectiveMode = requestedMode === 'adaptive' && isMediumViewport ? 'rail' : requestedMode
  const isOverlay = requestedMode === 'adaptive' && isNarrowViewport
  const showLabels = isOverlay ? isSidebarExpanded : effectiveMode === 'compact' || (effectiveMode === 'rail' && isSidebarExpanded)
  const sidebarIsVisible = isOverlay ? isSidebarExpanded : effectiveMode === 'rail' ? true : isSidebarExpanded
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const sidebarWidth = isOverlay
    ? isSidebarExpanded ? 'w-[216px]' : 'w-0'
    : effectiveMode === 'rail'
      ? isSidebarExpanded ? 'w-[216px]' : 'w-[56px]'
      : isSidebarExpanded ? 'w-[216px]' : 'w-0'
  const platformShortcut = useMemo(
    () => (window.electronAPI.platform === 'darwin' ? 'Cmd' : 'Ctrl'),
    []
  )

  useEffect(() => {
    const handleKeyboardHelp = (event: KeyboardEvent) => {
      const target = event.target
      if (event.key !== '?' || (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]'))) return
      event.preventDefault()
      setKeyboardHelpOpen(true)
    }
    document.addEventListener('keydown', handleKeyboardHelp)
    return () => document.removeEventListener('keydown', handleKeyboardHelp)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/15 selection:text-foreground">
      <aside
        id="devdesk-sidebar"
        aria-label="Primary navigation"
        aria-hidden={!sidebarIsVisible}
        className={cn(
          'flex shrink-0 flex-col border-border bg-card z-10 shadow-sm transition-[width,opacity,transform] duration-200 ease-out',
          sidebarWidth,
          isOverlay && 'absolute inset-y-0 left-0',
          sidebarIsVisible ? 'border-r opacity-100' : 'overflow-hidden border-r-0 opacity-0'
        )}
      >
        <div className={cn('flex h-12 shrink-0 items-center border-b border-border', showLabels ? 'px-3' : 'justify-center px-2')}>
          <div className={cn('flex items-center', showLabels ? 'gap-2.5' : 'gap-0')}>
            <img src={appIcon} alt="DevDesk logo" className="h-6 w-6 select-none rounded-md object-contain" draggable={false} />
            {showLabels && <span className="text-sm font-bold tracking-tight text-foreground">DevDesk</span>}
          </div>
        </div>

        <div className={cn('flex-1 px-2 py-3', !showLabels && 'px-1.5')}>
          <Tabs value={activeNav} onValueChange={onNavChange} orientation="vertical" className="flex flex-col">
            <TabsList className="flex h-auto w-full flex-col gap-1 rounded-none border-0 bg-transparent p-0 shadow-none">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.value
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    title={!showLabels ? `${item.label}${item.description ? `: ${item.description}` : ''}` : undefined}
                    aria-label={item.label}
                    className={cn(
                      'group relative h-9 w-full justify-start rounded-lg px-2.5 text-sm font-medium transition-colors duration-200 outline-none',
                      showLabels ? 'gap-2' : 'justify-center px-0',
                      'hover:bg-muted/60 hover:text-foreground',
                      isActive
                        ? cn(
                            'bg-primary/15 text-primary border border-primary/20',
                            effectiveMode === 'rail' && 'before:absolute before:left-0 before:top-2 before:h-5 before:w-0.5 before:rounded-full before:bg-primary'
                          )
                        : 'text-muted-foreground border border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground/80')} />
                    <span className={cn('flex-1 text-left', !showLabels && 'sr-only')}>{item.label}</span>
                    {showLabels && item.description && (
                      <span className="sr-only">{item.description}</span>
                    )}
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={cn('ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums', !showLabels && 'sr-only', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className={cn('p-2', showLabels ? 'px-2' : 'px-1.5')}>
          <button
            type="button"
            aria-label={`Open Quick Launcher. Keyboard shortcut: ${platformShortcut}+K`}
            title={!showLabels ? `Quick Launcher (${platformShortcut}+K)` : undefined}
            className={cn('flex h-9 w-full items-center rounded-lg border border-border/40 bg-muted/30 text-left shadow-sm', showLabels ? 'gap-2 px-2.5' : 'justify-center px-0', 'transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring group')}
            onClick={() => {
              const isMac = window.electronAPI.platform === 'darwin'
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ...(isMac ? { metaKey: true } : { ctrlKey: true }) }))
            }}
          >
            <Command className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            {showLabels && <span className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">Quick Launcher</span>}
            {showLabels && <kbd className="ml-auto pointer-events-none inline-flex h-[18px] select-none items-center rounded border border-border/50 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">{platformShortcut}K</kbd>}
          </button>
        </div>

        <div className={cn('px-2 pb-2', !showLabels && 'px-1.5')}>
          <ToolbarButton
            variant="ghost"
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts"
            onClick={() => setKeyboardHelpOpen(true)}
            className={cn('flex h-9 w-full items-center text-muted-foreground hover:text-foreground', showLabels ? 'justify-start gap-2 px-2.5' : 'justify-center px-0')}
          >
            <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {showLabels && <span className="truncate text-xs font-semibold">Keyboard shortcuts</span>}
            {showLabels && <kbd className="ml-auto inline-flex h-[18px] items-center rounded border border-border/50 bg-background/50 px-1.5 font-mono text-[10px] text-muted-foreground">?</kbd>}
          </ToolbarButton>
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="ghost" size="icon" aria-label={isSidebarExpanded ? 'Collapse sidebar to icon rail' : 'Expand sidebar to show labels'} title={isSidebarExpanded ? 'Collapse sidebar to the 56px icon rail' : 'Expand sidebar to show labels'} aria-expanded={isSidebarExpanded} aria-controls="devdesk-sidebar" onClick={() => setIsSidebarExpanded((expanded) => !expanded)} className="shrink-0 text-muted-foreground hover:text-foreground">
              {isSidebarExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h2>
              {titleDescription && <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{titleDescription}</p>}
            </div>
            {projects.length > 0 && (
              <ProjectContextSwitcher
                projects={projects}
                value={activeProjectId}
                onValueChange={onProjectChange}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {settingsButton && <div className="flex items-center gap-4 border-l border-border pl-4">{settingsButton}</div>}
            {action && <div className="flex items-center gap-4 border-l border-border pl-4">{action}</div>}
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-transparent">{children}</main>
      </div>

      <Dialog open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>
              Keep navigation and project work within reach without leaving the current screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <ShortcutRow label="Quick Launcher" keys={`${platformShortcut}+K`} detail="Search projects, commands, history, and actions" />
            <ShortcutRow label="New or focus terminal" keys={`${platformShortcut}+\u0060`} detail="Open a terminal session from any section" />
            <ShortcutRow label="Report a bug" keys={`${platformShortcut}+Shift+B`} detail="Capture a bug with the current project context" />
            <ShortcutRow label="Toggle terminal fullscreen" keys="F11" detail="Expand or restore the terminal workspace" />
            <ShortcutRow label="Sidebar" keys="Use the toggle" detail="Collapse to the 56px icon rail or expand labels" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShortcutRow({ label, keys, detail }: { label: string; keys: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <kbd className="mt-0.5 min-w-[68px] rounded border border-border bg-background px-1.5 py-0.5 text-center font-mono text-[11px] text-foreground shadow-sm">
        {keys}
      </kbd>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
