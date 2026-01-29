import { useState } from 'react'
import {
  FolderKanban,
  Terminal,
  Container as ContainerIcon,
  History,
  StickyNote,
  Search,
  Plus,
  MoreVertical,
  Play,
  Square,
  Trash2,
  ExternalLink,
  FileText,
  Logs,
  Power,
  Package,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { Badge } from './components/ui/Badge'
import { Alert, AlertDescription } from './components/ui/Alert'
import { ScrollArea } from './components/ui/ScrollArea'
import { Separator } from './components/ui/Separator'
import { Input } from './components/ui/Input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/Table'
import { mockProjects, mockCommands, mockContainers, mockRunHistory, mockNotes } from './lib/mockData'
import type { Project, Command, Container, RunHistoryEntry } from './types'

type TabValue = 'projects' | 'commands' | 'containers' | 'history' | 'notes'

interface NavItem {
  value: TabValue
  label: string
  icon: typeof FolderKanban
  description: string
}

const navItems: NavItem[] = [
  { value: 'projects', label: 'Projects', icon: FolderKanban, description: 'Manage your development projects' },
  { value: 'commands', label: 'Commands', icon: Terminal, description: 'Saved terminal commands' },
  { value: 'containers', label: 'Containers', icon: ContainerIcon, description: 'Docker containers' },
  { value: 'history', label: 'History', icon: History, description: 'Command execution history' },
  { value: 'notes', label: 'Notes', icon: StickyNote, description: 'Project notes and reminders' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabValue>('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const currentNavItem = navItems.find((item) => item.value === activeTab)!

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DevDesk</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Developer Workspace</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.value
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveTab(item.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Selected Project */}
        {selectedProject && (
          <>
            <Separator />
            <div className="p-4">
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Selected</p>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <span className="text-lg">{selectedProject.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedProject.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedProject.path}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-muted/30">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <currentNavItem.icon className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{currentNavItem.label}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{currentNavItem.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="w-64 pl-9 h-9 bg-background"
                />
              </div>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add New
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {activeTab === 'projects' && <ProjectsSection projects={mockProjects} onSelect={setSelectedProject} />}
            {activeTab === 'commands' && <CommandsSection commands={mockCommands} />}
            {activeTab === 'containers' && <ContainersSection containers={mockContainers} />}
            {activeTab === 'history' && <HistorySection history={mockRunHistory} />}
            {activeTab === 'notes' && <NotesSection projects={mockProjects} notes={mockNotes} />}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}

function ProjectsSection({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">All Projects</h3>
          <p className="text-2xl font-bold mt-1">{projects.length}</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h4 className="text-lg font-semibold mb-2">No projects yet</h4>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Add your first project to get started. DevDesk will auto-detect the project type.
            </p>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} className="cursor-pointer" onClick={() => onSelect(project)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{project.icon}</span>
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {project.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground font-mono">{project.path}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Terminal className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function CommandsSection({ commands }: { commands: Command[] }) {
  return (
    <div className="space-y-4">
      {commands.map((command) => (
        <Card key={command.id} className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{command.name}</CardTitle>
                {command.description && (
                  <CardDescription>{command.description}</CardDescription>
                )}
              </div>
              <Button size="sm" className="gap-2">
                <Play className="w-4 h-4" />
                Run
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto font-mono border">
                <code>{command.command}</code>
              </pre>
            </div>
            {command.tags && command.tags.length > 0 && (
              <div className="flex items-center gap-2">
                {command.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ContainersSection({ containers }: { containers: Container[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="gap-1.5 px-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {containers.filter((c) => c.state === 'running').length} Running
        </Badge>
        <Badge variant="secondary" className="gap-1.5 px-3">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          {containers.filter((c) => c.state !== 'running').length} Stopped
        </Badge>
      </div>

      <div className="grid gap-4">
        {containers.map((container) => (
          <Card key={container.id} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base">{container.name}</CardTitle>
                  </div>
                  <CardDescription className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    {container.image}
                  </CardDescription>
                </div>
                <Badge
                  variant={container.state === 'running' ? 'success' : 'secondary'}
                  className="gap-1.5"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${container.state === 'running' ? 'bg-white' : ''}`} />
                  {container.state}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {container.ports.length > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {container.ports.join(', ')}
                    </span>
                  ) : (
                    <span>No ports exposed</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {container.state === 'running' ? (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Logs className="w-4 h-4" />
                        Logs
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                        <Square className="w-4 h-4" />
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="default" className="gap-1.5">
                      <Power className="w-4 h-4" />
                      Start
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function HistorySection({ history }: { history: RunHistoryEntry[] }) {
  const getStatusBadge = (status: RunHistoryEntry['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="gap-1.5">Success</Badge>
      case 'running':
        return <Badge variant="default" className="gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Running
        </Badge>
      case 'failed':
        return <Badge variant="destructive" className="gap-1.5">Failed</Badge>
      case 'stopped':
        return <Badge variant="warning" className="gap-1.5">Stopped</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <Card key={entry.id} className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Command #{entry.commandId}</CardTitle>
                </div>
                <CardDescription>{new Date(entry.startTime).toLocaleString()}</CardDescription>
              </div>
              {getStatusBadge(entry.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {entry.output && (
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto font-mono text-muted-foreground max-h-48 overflow-y-auto">
                {entry.output}
              </pre>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5">
                <FileText className="w-4 h-4" />
                View Output
              </Button>
              {entry.status === 'running' && (
                <Button size="sm" variant="destructive" className="gap-1.5">
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function NotesSection({ projects, notes }: { projects: Project[]; notes: Record<string, any> }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {projects.map((project) => {
        const projectNotes = notes[project.id]
        return (
          <Card key={project.id} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{project.icon}</span>
                <CardTitle className="text-lg">{project.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ports
                </div>
                <p className="text-sm">{projectNotes?.ports || 'No ports saved'}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <ExternalLink className="w-3.5 h-3.5" />
                  URLs
                </div>
                <p className="text-sm whitespace-pre-line">{projectNotes?.urls || 'No URLs saved'}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <StickyNote className="w-3.5 h-3.5" />
                  Reminders
                </div>
                <p className="text-sm">{projectNotes?.reminders || 'No reminders'}</p>
              </div>
              <Separator />
              <Button size="sm" variant="outline" className="w-full gap-1.5">
                <StickyNote className="w-4 h-4" />
                Edit Notes
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default App
