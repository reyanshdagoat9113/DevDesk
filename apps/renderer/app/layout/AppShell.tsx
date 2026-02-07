import type { ReactNode } from 'react'
import { Sparkles, Command } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { ScrollArea } from '../components/ui/ScrollArea'
import { Separator } from '../components/ui/Separator'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'

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
  children: ReactNode
}

export function AppShell({ navItems, activeNav, onNavChange, title, action, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground">
      <aside className="flex w-60 flex-col border-r border-border/60 bg-card/80 backdrop-blur">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">DevDesk</p>
              <p className="text-xs text-muted-foreground">Workspace</p>
            </div>
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-2 py-3">
          <Tabs
            value={activeNav}
            onValueChange={onNavChange}
            orientation="vertical"
            className="flex h-full flex-col"
          >
            <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="group w-full justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground transition-colors group-data-[state=active]:text-foreground" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' ? (
                      <Badge
                        variant="secondary"
                        className="min-w-[26px] justify-center px-2 text-[10px] font-semibold"
                      >
                        {item.count}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </ScrollArea>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur">
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
              <Command className="h-3 w-3" />
              <span>+</span>
              <span>K</span>
            </div>
            {action ? <div className="flex items-center gap-2">{action}</div> : null}
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <div className="h-full p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
