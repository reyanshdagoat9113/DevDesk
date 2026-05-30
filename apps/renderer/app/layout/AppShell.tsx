import type { ReactNode } from 'react'
import { Command, Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { cn } from '../../lib/utils'

interface NavItem {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

interface AppShellProps {
  navItems: ReadonlyArray<NavItem>
  activeNav: string
  onNavChange: (value: string) => void
  title: string
  action?: ReactNode
  themeToggle?: ReactNode
  settingsButton?: ReactNode
  children: ReactNode
}

export function AppShell({ navItems, activeNav, onNavChange, title, action, themeToggle, settingsButton, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/15 selection:text-foreground">
      {/* Sidebar */}
      <aside className="flex w-[240px] flex-col border-r border-border bg-card z-10 shadow-sm">
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
              <Search className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">DevDesk</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 py-4">
          <Tabs
            value={activeNav}
            onValueChange={onNavChange}
            orientation="vertical"
            className="flex flex-col"
          >
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.value
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "group relative w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 outline-none",
                      "hover:bg-muted/60 hover:text-foreground",
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "text-muted-foreground border border-transparent"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground/80"
                    )} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={cn(
                        "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Quick Action */}
        <div className="p-4">
          <button
            type="button"
            aria-label={`Open Quick Launcher. Keyboard shortcut: ${window.electronAPI.platform === 'darwin' ? '⌘' : 'Ctrl'}+K`}
            className={cn(
              "w-full rounded-lg border border-border/40 bg-muted/30 p-3 text-left shadow-sm",
              "transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring group"
            )}
            onClick={() => {
              const isMac = window.electronAPI.platform === 'darwin'
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                ...(isMac ? { metaKey: true } : { ctrlKey: true }),
              })
              window.dispatchEvent(event)
            }}
          >
            <div className="flex items-center gap-3">
              <Command className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">Quick Launcher</p>
                <div className="flex items-center gap-1 mt-1">
                  <kbd className="pointer-events-none inline-flex h-[18px] select-none items-center gap-1 rounded border border-border/50 bg-background/50 font-mono text-[10px] font-medium text-muted-foreground px-1.5 shadow-sm">
                    <span className="text-[10px]">{window.electronAPI.platform === 'darwin' ? '⌘' : 'Ctrl'}</span>K
                  </kbd>
                </div>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {settingsButton && (
              <div className="flex items-center gap-4 pl-4 border-l border-border">
                {settingsButton}
              </div>
            )}
            {action && (
              <div className="flex items-center gap-4 pl-4 border-l border-border">
                {action}
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden bg-transparent">
          {children}
        </main>
      </div>
    </div>
  )
}
