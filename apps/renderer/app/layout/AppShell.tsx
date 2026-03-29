import type { ReactNode } from 'react'
import { Command, Search } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
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
  children: ReactNode
}

export function AppShell({ navItems, activeNav, onNavChange, title, action, themeToggle, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-card/30 via-background to-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Sidebar */}
      <aside className="flex w-[240px] flex-col border-r border-border/40 bg-card/40 backdrop-blur-xl z-10 shadow-2xl">
        {/* Logo */}
        <div className="flex h-[72px] items-center px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-gradient">DevDesk</h1>
              <p className="text-[10px] text-muted-foreground/80 font-medium">Code Intelligence</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 px-3 py-4">
          <p className="px-3 text-[10px] font-bold text-muted-foreground/50 mb-3 uppercase tracking-widest">
            Navigation
          </p>
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
                      "group relative w-full justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-300 outline-none",
                      "hover:bg-muted/40 hover:text-foreground",
                      isActive 
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                        : "text-muted-foreground"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    )}
                    
                    <span className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-[16px] w-[16px] transition-all duration-300",
                        isActive ? "text-primary drop-shadow-md" : "text-muted-foreground/70 group-hover:text-foreground"
                      )} />
                      <span>{item.label}</span>
                    </span>
                    
                    {typeof item.count === 'number' && item.count > 0 && (
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className={cn(
                          "ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[11px] font-medium transition-all duration-300 shadow-sm",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/50 text-muted-foreground border-border/40"
                        )}
                      >
                        {item.count > 99 ? '99+' : item.count}
                      </Badge>
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
            className={cn(
              "w-full rounded-xl border border-border/40 bg-muted/20 p-3 text-left shadow-sm",
              "transition-all duration-300 hover:bg-muted/40 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/20 group"
            )}
            onClick={() => {
              // Dispatch keyboard event to open command palette
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
              window.dispatchEvent(event)
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground shadow-sm group-hover:text-primary group-hover:border-primary/30 transition-all duration-300">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">Quick Launcher</p>
                <div className="flex items-center gap-1 mt-1">
                  <kbd className="pointer-events-none inline-flex h-[18px] select-none items-center gap-1 rounded border border-border/50 bg-background/50 font-mono text-[10px] font-medium text-muted-foreground px-1.5 shadow-sm">
                    <span className="text-[10px]">⌘</span>K
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
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/40 bg-background/40 backdrop-blur-xl px-8 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground/90">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {action && (
              <div className="flex items-center gap-4 pl-4 border-l border-border/40">
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
