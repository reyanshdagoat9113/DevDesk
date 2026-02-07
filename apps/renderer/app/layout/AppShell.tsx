import type { ReactNode } from 'react'
import { Sparkles, Command } from 'lucide-react'
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-border/40 bg-muted/10">
        <div className="flex h-[60px] items-center px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-none">
              <h1 className="text-sm font-bold tracking-tight">DevDesk</h1>
              <span className="text-[10px] text-muted-foreground font-medium">Workspace</span>
            </div>
          </div>
        </div>
        
        <div className="px-3 py-2">
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
                      "group w-full justify-between rounded-md px-3 py-2 text-sm font-medium transition-all outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-accent-foreground"
                      )} />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[10px]",
                          isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-lg border border-border/50 bg-card p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium">Quick Launcher</p>
                <p className="truncate text-[10px] text-muted-foreground">Press Cmd+K to start</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] items-center justify-between border-b border-border/40 px-6 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {themeToggle}
            {action && <div className="flex items-center gap-2 border-l border-border/40 pl-3">{action}</div>}
          </div>
        </header>
        <main className="flex-1 overflow-hidden bg-muted/5 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
