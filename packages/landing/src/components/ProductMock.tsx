import {
  Container,
  FolderKanban,
  History,
  Monitor,
  Search,
  Terminal,
} from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ScreenshotId } from '@/config/screenshots'

type ProductMockProps = {
  id: ScreenshotId
  className?: string
  /** Accessible name when used as the sole visual (no photo). */
  label: string
}

const nav = [
  { id: 'projects', icon: FolderKanban, label: 'Projects' },
  { id: 'commands', icon: Terminal, label: 'Commands' },
  { id: 'engine', icon: Search, label: 'Engine' },
  { id: 'containers', icon: Container, label: 'Containers' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'terminal', icon: Monitor, label: 'Terminal' },
] as const

/**
 * Stylised in-app UI used until a real screenshot is captured.
 * Layout mirrors the product shell; data is illustrative demo content only.
 */
export function ProductMock({ id, className, label }: ProductMockProps) {
  const active = id

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'flex size-full min-h-0 overflow-hidden rounded-[inherit] bg-background text-left',
        className,
      )}
    >
      {/* Sidebar */}
      <aside className="flex w-[4.25rem] shrink-0 flex-col gap-1 border-r border-border/60 bg-card/80 p-2 sm:w-44 sm:p-3">
        <div className="mb-2 hidden items-center gap-2 px-1 sm:flex">
          <span className="size-2 rounded-full bg-[#33d02b]" />
          <span className="text-xs font-semibold tracking-tight">DevDesk</span>
        </div>
        {nav.map((item) => {
          const Icon = item.icon
          const isActive = item.id === active
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                isActive
                  ? 'bg-brand/15 text-foreground ring-1 ring-brand/30'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden truncate sm:inline">{item.label}</span>
            </div>
          )
        })}
      </aside>

      {/* Main pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 items-center justify-between border-b border-border/60 px-3 sm:px-4">
          <span className="truncate text-xs font-medium capitalize text-muted-foreground">
            {id}
          </span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="hidden size-1.5 rounded-full bg-muted-foreground/40 sm:block" />
            <span className="hidden size-1.5 rounded-full bg-muted-foreground/40 sm:block" />
            <span className="size-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">{renderPane(id)}</div>
      </div>
    </div>
  )
}

function renderPane(id: ScreenshotId) {
  switch (id) {
    case 'projects':
      return <ProjectsPane />
    case 'commands':
      return <CommandsPane />
    case 'engine':
      return <EnginePane />
    case 'containers':
      return <ContainersPane />
    case 'terminal':
      return <TerminalPane />
    case 'history':
      return <HistoryPane />
  }
}

function ProjectsPane() {
  const rows = [
    { name: 'api-gateway', branch: 'main', health: 'ok', type: 'Node' },
    { name: 'web-console', branch: 'feat/auth', health: 'ok', type: 'Vite' },
    { name: 'worker-queue', branch: 'main', health: 'warn', type: 'Rust' },
    { name: 'docs-site', branch: 'main', health: 'ok', type: 'MDX' },
  ]
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Projects</p>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          4 pinned
        </Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li
            key={row.name}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2.5 py-2',
              i === 0 && 'ring-1 ring-brand/40',
            )}
          >
            <FolderKanban className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{row.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{row.branch}</p>
            </div>
            <Badge variant="secondary" className="hidden h-5 px-1.5 text-[10px] sm:inline-flex">
              {row.type}
            </Badge>
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                row.health === 'ok' ? 'bg-emerald-500' : 'bg-amber-400',
              )}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CommandsPane() {
  return (
    <div className="grid h-full gap-2 sm:grid-cols-[1fr_1.1fr]">
      <ul className="flex flex-col gap-1.5">
        {['dev', 'test:run', 'package:win', 'lint'].map((name, i) => (
          <li
            key={name}
            className={cn(
              'rounded-lg border border-border/50 bg-card/60 px-2.5 py-2',
              i === 0 && 'ring-1 ring-brand/40',
            )}
          >
            <p className="text-xs font-medium">{name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">npm run {name}</p>
          </li>
        ))}
      </ul>
      <div className="hidden flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-3 sm:flex">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Preset · local
        </p>
        <code className="rounded-md bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-foreground/90">
          npm run rebuild:native:electron
          <br />
          npm run dev
        </code>
        <div className="mt-auto flex gap-1.5">
          <Badge variant="outline" className="h-5 text-[10px]">
            chain
          </Badge>
          <Badge variant="outline" className="h-5 text-[10px]">
            $PROJECT
          </Badge>
        </div>
      </div>
    </div>
  )
}

function EnginePane() {
  const hits = [
    { file: 'apps/desktop/ipc/handlers.ts', line: '142', snip: 'ipcMain.handle("commands:run"' },
    { file: 'packages/engine/src/search.rs', line: '88', snip: 'fn rank_matches(query:' },
    { file: 'apps/renderer/app/sections/Engine.tsx', line: '54', snip: 'const results = await' },
  ]
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-2.5 py-2">
        <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-mono text-xs text-foreground/90">ipcMain.handle</span>
        <span className="ml-auto text-[10px] text-muted-foreground">3 results · local index</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {hits.map((hit) => (
          <li
            key={hit.file}
            className="rounded-lg border border-border/50 bg-card/50 px-2.5 py-2"
          >
            <p className="truncate font-mono text-[10px] text-brand">
              {hit.file}
              <span className="text-muted-foreground">:{hit.line}</span>
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{hit.snip}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContainersPane() {
  const rows = [
    { name: 'postgres', status: 'running', ports: '5432' },
    { name: 'redis', status: 'running', ports: '6379' },
    { name: 'mailhog', status: 'exited', ports: '8025' },
  ]
  return (
    <div className="flex h-full flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2.5 py-2"
        >
          <Container className="size-3.5 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">{row.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">:{row.ports}</p>
          </div>
          <Badge
            variant={row.status === 'running' ? 'success' : 'secondary'}
            className="h-5 text-[10px]"
          >
            {row.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function TerminalPane() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/50 bg-[#0a0a0a]">
      <div className="flex gap-1 border-b border-white/5 px-2 py-1.5">
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/80">
          api-gateway
        </span>
        <span className="rounded px-2 py-0.5 font-mono text-[10px] text-white/40">+</span>
      </div>
      <pre className="flex-1 overflow-hidden p-3 font-mono text-[10px] leading-relaxed text-emerald-400/90">
        {`$ npm run dev
  VITE v6 ready in 312 ms
  ➜  Local: http://127.0.0.1:5180
  electron main process online
  engine: index ready (1.2s)`}
      </pre>
    </div>
  )
}

function HistoryPane() {
  const runs = [
    { cmd: 'test:run', status: 0, dur: '12.4s' },
    { cmd: 'lint', status: 0, dur: '3.1s' },
    { cmd: 'package:win', status: 1, dur: '48s' },
  ]
  return (
    <ul className="flex h-full flex-col gap-1.5">
      {runs.map((run) => (
        <li
          key={run.cmd}
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2.5 py-2"
        >
          <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 font-mono text-xs">{run.cmd}</span>
          <span className="text-[10px] text-muted-foreground">{run.dur}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px]',
              run.status === 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-destructive/15 text-destructive',
            )}
          >
            {run.status}
          </span>
        </li>
      ))}
    </ul>
  )
}
