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
      <aside className="flex w-[260px] flex-col border-r border-border/50 bg-muted/30">
        <div className="flex h-[92px] items-center justify-center px-4">
          <BrandLogo className="h-[72px] w-[208px] translate-x-10" />
        </div>
        
        <div className="px-4 py-6 flex-1">
          <p className="px-2 text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Menu</p>
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
                      "group w-full justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 outline-none",
                      "hover:bg-muted text-muted-foreground hover:text-foreground",
                      "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-none"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-[18px] w-[18px] transition-colors duration-200",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[11px] font-medium transition-all",
                          isActive 
                            ? "bg-primary/20 text-primary" 
                            : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground/20"
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
          <div className="rounded-xl border border-border/50 bg-background p-3 shadow-sm hover:border-primary/30 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-foreground transition-colors">Quick Launcher</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">Press</span>
                  <kbd className="pointer-events-none inline-flex h-[18px] select-none items-center gap-1 rounded border bg-muted font-mono text-[10px] font-medium text-muted-foreground px-1.5">
                    <span className="text-[10px]">⌘</span>K
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden relative bg-muted/10">
        <header className="relative z-10 flex h-[72px] shrink-0 items-center justify-between border-b border-border/50 px-8 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {themeToggle}
            {action && (
              <div className="flex items-center gap-4 pl-4 border-l border-border/50">
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
