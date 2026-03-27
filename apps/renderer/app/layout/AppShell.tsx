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
    <div className="flex h-screen overflow-hidden bg-black text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Sidebar */}
      <aside className="flex w-[240px] flex-col border-r border-white/5 bg-[#0a0a0a]">
        {/* Logo */}
        <div className="flex h-[72px] items-center px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">DevDesk</h1>
              <p className="text-[10px] text-muted-foreground">Code Intelligence</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 px-3 py-4">
          <p className="px-3 text-[10px] font-semibold text-muted-foreground/60 mb-2 uppercase tracking-wider">
            Navigation
          </p>
          <Tabs
            value={activeNav}
            onValueChange={onNavChange}
            orientation="vertical"
            className="flex flex-col"
          >
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.value
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "group relative w-full justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 outline-none",
                      "hover:bg-white/5 hover:text-foreground",
                      isActive 
                        ? "bg-white/10 text-foreground" 
                        : "text-muted-foreground"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground rounded-r-full" />
                    )}
                    
                    <span className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-[16px] w-[16px] transition-colors duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span>{item.label}</span>
                    </span>
                    
                    {typeof item.count === 'number' && item.count > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[11px] font-medium transition-all",
                          isActive 
                            ? "bg-white/20 text-foreground" 
                            : "bg-white/5 text-muted-foreground"
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
        <div className="p-3">
          <button 
            className={cn(
              "w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left",
              "transition-all duration-200 hover:bg-white/10 hover:border-white/20"
            )}
            onClick={() => {
              // Dispatch keyboard event to open command palette
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
              window.dispatchEvent(event)
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-foreground">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-foreground">Quick Launcher</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <kbd className="pointer-events-none inline-flex h-[18px] select-none items-center gap-1 rounded border border-white/20 bg-white/5 font-mono text-[10px] font-medium text-muted-foreground px-1.5">
                    <span className="text-[10px]">⌘</span>K
                  </kbd>
                </div>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-black">
        {/* Header */}
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/5 px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {action && (
              <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                {action}
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden bg-black">
          {children}
        </main>
      </div>
    </div>
  )
}
