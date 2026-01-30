import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container, FolderKanban, History, Plus, StickyNote, Terminal } from 'lucide-react'
import { Button } from './components/ui/Button'
import { Input } from './components/ui/Input'
import { Label } from './components/ui/Label'
import { Textarea } from './components/ui/Textarea'
import { Alert, AlertDescription, AlertTitle } from './components/ui/Alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/Dialog'
import { AppShell } from './layout/AppShell'
import { CommandsSection } from './sections/CommandsSection'
import { ContainersSection } from './sections/ContainersSection'
import { HistorySection } from './sections/HistorySection'
import { NotesSection } from './sections/NotesSection'
import { ProjectsSection } from './sections/ProjectsSection'
import type { Command, Container as ContainerType, Project, ProjectNotes, RunHistoryEntry } from './types'

type TabValue = 'projects' | 'commands' | 'containers' | 'history' | 'notes'

const navItems = [
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'commands', label: 'Commands', icon: Terminal },
  { value: 'containers', label: 'Containers', icon: Container },
  { value: 'history', label: 'History', icon: History },
  { value: 'notes', label: 'Notes', icon: StickyNote },
] as const

const actionLabels: Partial<Record<TabValue, string>> = {
  projects: 'Add Project',
  commands: 'New Command',
}

function App() {
  const [activeTab, setActiveTab] = useState<TabValue>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [commands, setCommands] = useState<Command[]>([])
  const [containers, setContainers] = useState<ContainerType[]>([])
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [notes, setNotes] = useState<Record<string, ProjectNotes>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)

  const [commandDialogOpen, setCommandDialogOpen] = useState(false)
  const [commandName, setCommandName] = useState('')
  const [commandValue, setCommandValue] = useState('')
  const [commandDescription, setCommandDescription] = useState('')
  const [commandTags, setCommandTags] = useState('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [isSavingCommand, setIsSavingCommand] = useState(false)

  const title = useMemo(() => navItems.find((item) => item.value === activeTab)?.label ?? '', [activeTab])
  const actionLabel = actionLabels[activeTab]

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [nextProjects, nextCommands, nextContainers, nextHistory] = await Promise.all([
        window.electronAPI.getProjects(),
        window.electronAPI.getCommands(),
        window.electronAPI.getContainers(),
        window.electronAPI.getRunHistory(),
      ])

      setProjects(nextProjects)
      setCommands(nextCommands)
      setContainers(nextContainers)
      setHistory(nextHistory)

      const notesEntries = await Promise.all(
        nextProjects.map((project) => window.electronAPI.getNotes(project.id))
      )
      const notesMap = notesEntries.reduce<Record<string, ProjectNotes>>((acc, entry) => {
        acc[entry.projectId] = entry
        return acc
      }, {})
      setNotes(notesMap)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load data.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const unsubscribeOutput = window.electronAPI.onRunOutput(({ runId, chunk }) => {
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                output: `${entry.output ?? ''}${chunk}`,
              }
            : entry
        )
      )
    })

    const unsubscribeStatus = window.electronAPI.onRunStatus(({ runId, status }) => {
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                status: status as RunHistoryEntry['status'],
                endTime: new Date().toISOString(),
              }
            : entry
        )
      )
    })

    return () => {
      unsubscribeOutput()
      unsubscribeStatus()
    }
  }, [])

  const handleAddProject = async () => {
    const trimmed = projectPath.trim()
    if (!trimmed) {
      setProjectError('Project path is required.')
      return
    }
    setProjectError(null)
    setIsSavingProject(true)
    try {
      const project = await window.electronAPI.addProject(trimmed)
      setProjects((prev) => {
        if (prev.some((item) => item.id === project.id)) {
          return prev
        }
        return [project, ...prev]
      })
      const projectNotes = await window.electronAPI.getNotes(project.id)
      setNotes((prev) => ({ ...prev, [projectNotes.projectId]: projectNotes }))
      setProjectPath('')
      setProjectDialogOpen(false)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Failed to add project.')
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleAddCommand = async () => {
    const trimmedName = commandName.trim()
    const trimmedCommand = commandValue.trim()
    if (!trimmedName || !trimmedCommand) {
      setCommandError('Command name and command are required.')
      return
    }
    setCommandError(null)
    setIsSavingCommand(true)
    try {
      const tags = commandTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      const command = await window.electronAPI.addCommand({
        name: trimmedName,
        command: trimmedCommand,
        description: commandDescription.trim() || undefined,
        tags: tags.length ? tags : undefined,
      })
      setCommands((prev) => [command, ...prev])
      setCommandName('')
      setCommandValue('')
      setCommandDescription('')
      setCommandTags('')
      setCommandDialogOpen(false)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'Failed to add command.')
    } finally {
      setIsSavingCommand(false)
    }
  }

  const handleRunCommand = async (commandId: string) => {
    try {
      const run = await window.electronAPI.runCommand(commandId)
      const startTime = new Date().toISOString()
      setHistory((prev) => [
        {
          id: run.runId,
          commandId,
          status: 'running',
          startTime,
          output: '',
        },
        ...prev,
      ])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to run command.')
    }
  }

  const handleStopRun = async (runId: string) => {
    try {
      await window.electronAPI.stopCommand(runId)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to stop command.')
    }
  }

  const handleLoadOutput = async (runId: string) => {
    try {
      const output = await window.electronAPI.getRunOutput(runId)
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                output,
              }
            : entry
        )
      )
      return output
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load output.')
      throw error
    }
  }

  const handleSaveNotes = async (projectId: string, updates: Partial<ProjectNotes>) => {
    try {
      await window.electronAPI.updateNotes(projectId, updates)
      setNotes((prev) => ({
        ...prev,
        [projectId]: {
          projectId,
          ports: updates.ports ?? prev[projectId]?.ports ?? '',
          urls: updates.urls ?? prev[projectId]?.urls ?? '',
          reminders: updates.reminders ?? prev[projectId]?.reminders ?? '',
        },
      }))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to update notes.')
      throw error
    }
  }

  return (
    <>
      <AppShell
        navItems={navItems}
        activeNav={activeTab}
        onNavChange={(value) => setActiveTab(value as TabValue)}
        title={title}
        action={
          actionLabel ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={() =>
                activeTab === 'projects' ? setProjectDialogOpen(true) : setCommandDialogOpen(true)
              }
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null
        }
      >
        <div className="h-full">
          {activeTab === 'projects' && (
            <ProjectsSection projects={projects} isLoading={isLoading} error={loadError} />
          )}
          {activeTab === 'commands' && (
            <CommandsSection
              commands={commands}
              isLoading={isLoading}
              error={loadError}
              onRunCommand={handleRunCommand}
            />
          )}
          {activeTab === 'containers' && (
            <ContainersSection containers={containers} isLoading={isLoading} error={loadError} />
          )}
          {activeTab === 'history' && (
            <HistorySection
              history={history}
              isLoading={isLoading}
              error={loadError}
              onStopRun={handleStopRun}
              onLoadOutput={handleLoadOutput}
            />
          )}
          {activeTab === 'notes' && (
            <NotesSection
              projects={projects}
              notes={notes}
              isLoading={isLoading}
              error={loadError}
              onSaveNotes={handleSaveNotes}
            />
          )}
        </div>
      </AppShell>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription>Enter a local folder path to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="project-path">Project path</Label>
              <Input
                id="project-path"
                value={projectPath}
                onChange={(event) => setProjectPath(event.target.value)}
                placeholder="C:\\Users\\name\\project"
              />
            </div>
            {projectError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not add project</AlertTitle>
                <AlertDescription>{projectError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProject} disabled={isSavingProject}>
              {isSavingProject ? 'Adding...' : 'Add Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commandDialogOpen} onOpenChange={setCommandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Command</DialogTitle>
            <DialogDescription>Save a reusable command for your workflows.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="command-name">Name</Label>
              <Input
                id="command-name"
                value={commandName}
                onChange={(event) => setCommandName(event.target.value)}
                placeholder="Run tests"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="command-value">Command</Label>
              <Textarea
                id="command-value"
                value={commandValue}
                onChange={(event) => setCommandValue(event.target.value)}
                placeholder="npm test -- --watch"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="command-description">Description (optional)</Label>
              <Input
                id="command-description"
                value={commandDescription}
                onChange={(event) => setCommandDescription(event.target.value)}
                placeholder="Run tests in watch mode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="command-tags">Tags (comma separated)</Label>
              <Input
                id="command-tags"
                value={commandTags}
                onChange={(event) => setCommandTags(event.target.value)}
                placeholder="test, watch"
              />
            </div>
            {commandError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not add command</AlertTitle>
                <AlertDescription>{commandError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommandDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCommand} disabled={isSavingCommand}>
              {isSavingCommand ? 'Saving...' : 'Save Command'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
