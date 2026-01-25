import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/Tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { Badge } from './components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from './components/ui/Alert'
import { mockProjects, mockCommands, mockContainers, mockRunHistory, mockNotes } from './lib/mockData'
import type { Project, Command, Container, RunHistoryEntry } from './types'

function App() {
  const [activeTab, setActiveTab] = useState('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight">DevDesk</h1>
          <p className="text-xs text-muted-foreground mt-1">Developer Workspace</p>
        </div>
        <nav className="p-2 space-y-1">
          {['projects', 'commands', 'containers', 'history', 'notes'].map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === item
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              }`}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        {selectedProject && (
          <div className="p-4 border-t border-border mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Selected Project</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedProject.icon}</span>
              <span className="text-sm font-medium">{selectedProject.name}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div>
            <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'projects' && 'Manage your development projects'}
              {activeTab === 'commands' && 'Saved terminal commands'}
              {activeTab === 'containers' && 'Docker containers'}
              {activeTab === 'history' && 'Command execution history'}
              {activeTab === 'notes' && 'Project notes and reminders'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>
            <Button size="sm">+ Add New</Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'projects' && <ProjectsSection projects={mockProjects} onSelect={setSelectedProject} />}
          {activeTab === 'commands' && <CommandsSection commands={mockCommands} />}
          {activeTab === 'containers' && <ContainersSection containers={mockContainers} />}
          {activeTab === 'history' && <HistorySection history={mockRunHistory} />}
          {activeTab === 'notes' && <NotesSection projects={mockProjects} notes={mockNotes} />}
        </div>
      </main>
    </div>
  )
}

function ProjectsSection({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return (
    <div className="space-y-4">
      <Alert>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <AlertTitle>No projects yet</AlertTitle>
        <AlertDescription>
          Add your first project to get started. DevDesk will auto-detect the project type.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onSelect(project)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{project.icon}</span>
                  <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription className="text-xs">{project.path}</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">{project.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Open
                </Button>
                <Button size="sm" variant="outline">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Terminal
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CommandsSection({ commands }: { commands: Command[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {commands.map((command) => (
          <Card key={command.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{command.name}</CardTitle>
                  {command.description && (
                    <CardDescription className="mt-1">{command.description}</CardDescription>
                  )}
                </div>
                <Button size="sm">Run</Button>
              </div>
            </CardHeader>
            <CardContent>
              <code className="text-sm bg-muted px-2 py-1 rounded">{command.command}</code>
              {command.tags && command.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {command.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ContainersSection({ containers }: { containers: Container[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {containers.map((container) => (
          <Card key={container.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{container.name}</CardTitle>
                  <CardDescription className="mt-1">{container.image}</CardDescription>
                </div>
                <Badge variant={container.state === 'running' ? 'success' : 'secondary'}>
                  {container.state}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {container.ports.length > 0 ? (
                    <span>Ports: {container.ports.join(', ')}</span>
                  ) : (
                    <span>No ports exposed</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {container.state === 'running' ? (
                    <>
                      <Button size="sm" variant="outline">
                        Logs
                      </Button>
                      <Button size="sm" variant="destructive">
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button size="sm">Start</Button>
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
        return <Badge variant="success">Success</Badge>
      case 'running':
        return <Badge variant="default">Running</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'stopped':
        return <Badge variant="warning">Stopped</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {history.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">Command #{entry.commandId}</CardTitle>
                  <CardDescription className="mt-1">
                    {new Date(entry.startTime).toLocaleString()}
                  </CardDescription>
                </div>
                {getStatusBadge(entry.status)}
              </div>
            </CardHeader>
            <CardContent>
              {entry.output && (
                <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                  {entry.output}
                </pre>
              )}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline">
                  View Output
                </Button>
                {entry.status === 'running' && (
                  <Button size="sm" variant="destructive">
                    Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function NotesSection({ projects, notes }: { projects: Project[]; notes: Record<string, any> }) {
  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const projectNotes = notes[project.id]
        return (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{project.icon}</span>
                <CardTitle>{project.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ports</label>
                <p className="text-sm mt-1">{projectNotes?.ports || 'No ports saved'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">URLs</label>
                <p className="text-sm mt-1 whitespace-pre-line">{projectNotes?.urls || 'No URLs saved'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reminders</label>
                <p className="text-sm mt-1">{projectNotes?.reminders || 'No reminders'}</p>
              </div>
              <Button size="sm" variant="outline">
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
