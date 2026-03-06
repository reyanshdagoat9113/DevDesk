import type { ReactNode } from 'react'
import { Command } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { BrandLogo } from '../components/BrandLogo'
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="flex h-[92px] items-center justify-center px-4">
          <BrandLogo className="h-[72px] w-[208px] translate-x-8" />
        </div>
        
        <div className="px-3 py-4">
          <Tabs
            value={activeNav}
            onValueChange={onNavChange}
            orientation="vertical"
            className="flex flex-col"
          >
            <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.value
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "group w-full justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 outline-none",
                      "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                      "data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:rounded-l-none"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        isActive ? "text-primary drop-shadow-sm" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[10px] font-semibold transition-all",
                          isActive 
                            ? "bg-background/80 text-primary shadow-sm" 
                            : "bg-muted/50 text-muted-foreground group-hover:bg-muted"
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
          <div className="rounded-xl border border-border/40 bg-gradient-to-b from-card/50 to-muted/20 p-3.5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 border border-border/20 text-muted-foreground shadow-sm">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold">Quick Launcher</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">Press</span>
                  <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted font-mono text-[10px] font-medium text-muted-foreground opacity-100 px-1">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        
        <header className="relative z-10 flex h-[68px] items-center justify-between border-b border-border/40 px-8 glass">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold tracking-tight text-foreground/90">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {action && (
              <div className="flex items-center gap-2 border-l border-border/40 pl-4">
                {action}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-hidden p-6 relative z-0">
          {children}
        </main>
      </div>
    </div>
  )
}
