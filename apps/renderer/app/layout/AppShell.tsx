import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { ScrollArea } from '../components/ui/ScrollArea'

interface NavItem {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface AppShellProps {
  navItems: NavItem[]
  activeNav: string
  onNavChange: (value: string) => void
  title: string
  action?: ReactNode
  children: ReactNode
}

export function AppShell({ navItems, activeNav, onNavChange, title, action, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 flex-col border-r border-border bg-card">
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
        <ScrollArea className="flex-1 px-2 pb-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.value
              return (
                <button
                  key={item.value}
                  onClick={() => onNavChange(item.value)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </ScrollArea>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <h1 className="text-base font-semibold">{title}</h1>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </header>
        <main className="flex-1 overflow-hidden">
          <div className="h-full p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
