import { useCallback, useEffect, useMemo, useState } from 'react'
import { Container, FolderKanban, History, Plus, StickyNote, Terminal, Folder, Globe, SearchCode } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/Select'
import { AppShell } from './layout/AppShell'
import { CommandsSection } from './sections/CommandsSection'
import { ContainersSection } from './sections/ContainersSection'
import { HistorySection } from './sections/HistorySection'
import { NotesSection } from './sections/NotesSection'
import { ProjectsSection } from './sections/ProjectsSection'
import { EngineSection } from './sections/EngineSection'
import type {
  AppPreferences,
  Command,
  Container as ContainerType,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  Project,
  ProjectNotes,
  RunHistoryEntry,
} from './types'

type TabValue = 'projects' | 'engine' | 'commands' | 'containers' | 'history' | 'notes'

const navItems = [
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'engine', label: 'Search', icon: SearchCode },
  { value: 'commands', label: 'Commands', icon: Terminal },
  { value: 'containers', label: 'Containers', icon: Container },
  { value: 'history', label: 'History', icon: History },
  { value: 'notes', label: 'Notes', icon: StickyNote },
] as const

const actionLabels: Partial<Record<TabValue, string>> = {
  projects: 'Add Project',
  commands: 'New Command',
}

const GLOBAL_COMMAND_VALUE = '__global__'

function App() {
  const [activeTab, setActiveTab] = useState<TabValue>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [commands, setCommands] = useState<Command[]>([])
  const [containers, setContainers] = useState<ContainerType[]>([])
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [notes, setNotes] = useState<Record<string, ProjectNotes>>({})
  const [preferences, setPreferences] = useState<AppPreferences | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)
  const [engineIndexes, setEngineIndexes] = useState<Record<string, EngineIndexMeta>>({})
  const [engineSearchSessions, setEngineSearchSessions] = useState<Record<string, EngineSearchSession>>({})
  const [engineSelectedProjectId, setEngineSelectedProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [containerError, setContainerError] = useState<string | null>(null)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isPickingProject, setIsPickingProject] = useState(false)
  const [wslDistros, setWslDistros] = useState<string[]>([])
  const [selectedWslDistro, setSelectedWslDistro] = useState('')
  const [wslDistroInput, setWslDistroInput] = useState('')
  const [isLoadingWslDistros, setIsLoadingWslDistros] = useState(false)

  const [commandDialogOpen, setCommandDialogOpen] = useState(false)
  const [commandName, setCommandName] = useState('')
  const [commandValue, setCommandValue] = useState('')
  const [commandDescription, setCommandDescription] = useState('')
  const [commandTags, setCommandTags] = useState('')
  const [commandProjectId, setCommandProjectId] = useState<string>(GLOBAL_COMMAND_VALUE)
  const [commandWorkingDirectory, setCommandWorkingDirectory] = useState<string>('')
  const [availableDirectories, setAvailableDirectories] = useState<string[]>([])
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false)
  const [directorySelectKey, setDirectorySelectKey] = useState<string>('0')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [isSavingCommand, setIsSavingCommand] = useState(false)

  const title = useMemo(() => navItems.find((item) => item.value === activeTab)?.label ?? '', [activeTab])
  const actionLabel = actionLabels[activeTab]
  const navItemsWithCounts = useMemo(() => {
    const counts: Record<TabValue, number> = {
      projects: projects.length,
      engine: projects.length,
      commands: commands.length,
      containers: containers.length,
      history: history.length,
      notes: projects.length,
    }
    return navItems.map((item) => ({
      ...item,
      count: counts[item.value],
    }))
  }, [projects.length, commands.length, containers.length, history.length])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setContainerError(null)
    try {
      const [projectsResult, commandsResult, containersResult, historyResult, preferencesResult, engineStatusResult, engineIndexesResult, engineSearchSessionsResult] =
        await Promise.allSettled([
          window.electronAPI.getProjects(),
          window.electronAPI.getCommands(),
          window.electronAPI.getContainers(),
          window.electronAPI.getRunHistory(),
          window.electronAPI.getPreferences(),
          window.electronAPI.engineStatus(),
          window.electronAPI.engineIndexes(),
          window.electronAPI.engineSearchSessions(),
        ])

      const errors: string[] = []

      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value)
      } else {
        errors.push(projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Failed to load projects.')
        setProjects([])
      }

      if (commandsResult.status === 'fulfilled') {
        setCommands(commandsResult.value)
      } else {
        errors.push(commandsResult.reason instanceof Error ? commandsResult.reason.message : 'Failed to load commands.')
        setCommands([])
      }

      if (containersResult.status === 'fulfilled') {
        setContainers(containersResult.value)
      } else {
        setContainerError(containersResult.reason instanceof Error ? containersResult.reason.message : 'Failed to load containers.')
        setContainers([])
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value)
      } else {
        errors.push(historyResult.reason instanceof Error ? historyResult.reason.message : 'Failed to load history.')
        setHistory([])
      }

      if (preferencesResult.status === 'fulfilled') {
        setPreferences(preferencesResult.value)
      } else {
        errors.push(preferencesResult.reason instanceof Error ? preferencesResult.reason.message : 'Failed to load preferences.')
        setPreferences(null)
      }

      if (engineStatusResult.status === 'fulfilled') {
        setEngineStatus(engineStatusResult.value)
      } else {
        errors.push(engineStatusResult.reason instanceof Error ? engineStatusResult.reason.message : 'Failed to load engine status.')
        setEngineStatus(null)
      }

      if (engineIndexesResult.status === 'fulfilled') {
        setEngineIndexes(engineIndexesResult.value)
      } else {
        errors.push(engineIndexesResult.reason instanceof Error ? engineIndexesResult.reason.message : 'Failed to load engine indexes.')
        setEngineIndexes({})
      }

      if (engineSearchSessionsResult.status === 'fulfilled') {
        setEngineSearchSessions(engineSearchSessionsResult.value)
      } else {
        errors.push(
          engineSearchSessionsResult.reason instanceof Error
            ? engineSearchSessionsResult.reason.message
            : 'Failed to load saved engine searches.'
        )
        setEngineSearchSessions({})
      }

      if (projectsResult.status === 'fulfilled') {
        try {
          const notesEntries = await Promise.all(
            projectsResult.value.map((project) => window.electronAPI.getNotes(project.id))
          )
          const notesMap = notesEntries.reduce<Record<string, ProjectNotes>>((acc, entry) => {
            acc[entry.projectId] = entry
            return acc
          }, {})
          setNotes(notesMap)
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to load notes.')
          setNotes({})
        }
      } else {
        setNotes({})
      }

      setLoadError(errors.length ? errors[0] : null)
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
    if (!projects.length) {
      setEngineSelectedProjectId(null)
      return
    }
    if (!engineSelectedProjectId || !projects.some((project) => project.id === engineSelectedProjectId)) {
      setEngineSelectedProjectId(projects[0].id)
    }
  }, [engineSelectedProjectId, projects])

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

  useEffect(() => {
    if (!projectDialogOpen) {
      return
    }

    let canceled = false
    const loadWslDistros = async () => {
      setIsLoadingWslDistros(true)
      try {
        const distros = await window.electronAPI.listWslDistros()
        if (canceled) {
          return
        }
        setWslDistros(distros)
        const nextSelected = distros[0] ?? ''
        setSelectedWslDistro((current) => (current && distros.includes(current) ? current : nextSelected))
        setWslDistroInput((current) => {
          const trimmed = current.trim()
          if (trimmed && distros.includes(trimmed)) {
            return trimmed
          }
          return nextSelected || trimmed
        })
      } catch {
        if (canceled) {
          return
        }
        setWslDistros([])
        setSelectedWslDistro('')
        setWslDistroInput((current) => (current.trim() ? current : 'Ubuntu'))
      } finally {
        if (!canceled) {
          setIsLoadingWslDistros(false)
        }
      }
    }

    void loadWslDistros()
    return () => {
      canceled = true
    }
  }, [projectDialogOpen])

  const handleWslDistroSelect = (distro: string) => {
    setSelectedWslDistro(distro)
    setWslDistroInput(distro)
  }

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

  const handleUpdateProject = async (projectId: string, updates: { name: string }) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateProject(projectId, updates)
      setProjects((prev) => prev.map((project) => (project.id === projectId ? updated : project)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update project.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRemoveProject = async (projectId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeProject(projectId)
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
      setHistory((prev) => prev.filter((entry) => entry.projectId !== projectId))
      setNotes((prev) => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove project.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handlePickProject = async () => {
    setProjectError(null)
    setIsPickingProject(true)
    try {
      const result = await window.electronAPI.openProjectFolderDialog()
      if (!result.canceled && result.path) {
        setProjectPath(result.path)
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Failed to open folder picker.')
    } finally {
      setIsPickingProject(false)
    }
  }

  const getWslStartPath = () => {
    const distro = selectedWslDistro.trim() || wslDistroInput.trim() || 'Ubuntu'
    return `\\\\wsl.localhost\\${distro}\\home\\`
  }

  const handlePickWslProject = async () => {
    setProjectError(null)
    setIsPickingProject(true)
    try {
      const result = await window.electronAPI.openProjectFolderDialog(getWslStartPath())
      if (!result.canceled && result.path) {
        setProjectPath(result.path)
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Failed to open WSL folder picker.')
    } finally {
      setIsPickingProject(false)
    }
  }

  const handlePrefillWslPath = () => {
    setProjectError(null)
    setProjectPath(getWslStartPath())
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
        projectId: commandProjectId === GLOBAL_COMMAND_VALUE ? undefined : commandProjectId,
        workingDirectory: commandWorkingDirectory === '__root__' || !commandWorkingDirectory.trim()
          ? undefined
          : commandWorkingDirectory.trim(),
      })
      setCommands((prev) => [command, ...prev])
      // Reset form
      setCommandName('')
      setCommandValue('')
      setCommandDescription('')
      setCommandTags('')
      setCommandProjectId(GLOBAL_COMMAND_VALUE)
      setCommandWorkingDirectory('')
      setAvailableDirectories([])
      setDirectorySelectKey('0')
      setCommandDialogOpen(false)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'Failed to add command.')
    } finally {
      setIsSavingCommand(false)
    }
  }

  const handleUpdateCommand = async (
    commandId: string,
    updates: { name: string; command: string; description?: string; tags?: string[] }
  ) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateCommand(commandId, updates)
      setCommands((prev) => prev.map((command) => (command.id === commandId ? updated : command)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update command.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRemoveCommand = async (commandId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeCommand(commandId)
      setCommands((prev) => prev.filter((command) => command.id !== commandId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove command.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleProjectChange = async (projectId: string) => {
    setCommandProjectId(projectId)
    setCommandWorkingDirectory('')
    setAvailableDirectories([])
    setDirectorySelectKey(String(Date.now())) // Force Select to re-render
    if (projectId !== GLOBAL_COMMAND_VALUE && window.electronAPI.getProjectDirectories) {
      setIsLoadingDirectories(true)
      try {
        const dirs = await window.electronAPI.getProjectDirectories(projectId)
        setAvailableDirectories(dirs)
      } catch (error) {
        console.error('Failed to load directories:', error)
        setAvailableDirectories([])
      } finally {
        setIsLoadingDirectories(false)
      }
    }
  }

  const handleWorkingDirectoryChange = async (dir: string) => {
    // Convert __root__ to empty string for storage, but keep __root__ for UI
    const actualDir = dir === '__root__' ? '' : dir
    setCommandWorkingDirectory(dir) // Keep the UI value
    // Load subdirectories if a non-empty directory is selected
    if (commandProjectId !== GLOBAL_COMMAND_VALUE && actualDir && window.electronAPI.getProjectDirectories) {
      setIsLoadingDirectories(true)
      try {
        const subdirs = await window.electronAPI.getProjectDirectories(commandProjectId, actualDir)
        setAvailableDirectories(subdirs)
      } catch (error) {
        console.error('Failed to load subdirectories:', error)
        setAvailableDirectories([])
      } finally {
        setIsLoadingDirectories(false)
      }
    } else if (commandProjectId !== GLOBAL_COMMAND_VALUE && !actualDir) {
      // Reset to root directories when "Project root" is selected
      setIsLoadingDirectories(true)
      try {
        const dirs = await window.electronAPI.getProjectDirectories(commandProjectId)
        setAvailableDirectories(dirs)
      } catch (error) {
        console.error('Failed to load directories:', error)
        setAvailableDirectories([])
      } finally {
        setIsLoadingDirectories(false)
      }
    }
  }

  const handleRunCommand = async (commandId: string, projectId: string) => {
    setLoadError(null)
    try {
      const run = await window.electronAPI.runCommand(commandId, projectId)
      const startTime = new Date().toISOString()
      setHistory((prev) => [
        {
          id: run.runId,
          commandId,
          projectId,
          status: 'running',
          startTime,
          output: '',
        },
        ...prev,
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run command.'
      setLoadError(message)
      throw new Error(message)
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

  const handleClearHistory = async () => {
    setLoadError(null)
    try {
      await window.electronAPI.clearRunHistory()
      setHistory([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear history.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleSaveNotes = async (projectId: string, updates: Partial<ProjectNotes>) => {
    try {
      await window.electronAPI.updateNotes(projectId, updates)
      setNotes((prev) => ({
        ...prev,
        [projectId]: {
          projectId,
          setupSteps: updates.setupSteps ?? prev[projectId]?.setupSteps ?? '',
          todos: updates.todos ?? prev[projectId]?.todos ?? '',
          reminders: updates.reminders ?? prev[projectId]?.reminders ?? '',
        },
      }))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to update notes.')
      throw error
    }
  }

  const handleSavePreferences = async (next: AppPreferences) => {
    await window.electronAPI.updatePreferences(next)
    setPreferences(next)
  }

  const refreshEngineState = async () => {
    const [nextStatus, nextIndexes] = await Promise.all([
      window.electronAPI.engineStatus(),
      window.electronAPI.engineIndexes(),
    ])
    setEngineStatus(nextStatus)
    setEngineIndexes(nextIndexes)
  }

  const handleIndexProject = async (projectId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.engineIndex(projectId)
      await refreshEngineState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to index project.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleEngineSearch = async (
    projectId: string,
    query: string,
    options?: { regex?: boolean; limit?: number }
  ): Promise<EngineSearchResult> => {
    setLoadError(null)
    try {
      const result = await window.electronAPI.engineSearch(projectId, query, options)
      setEngineSearchSessions((prev) => ({
        ...prev,
        [projectId]: {
          projectId,
          query,
          regex: options?.regex ?? false,
          updatedAt: new Date().toISOString(),
          result,
        },
      }))
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Engine search failed.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleLoadEngineStats = async (projectId: string): Promise<EngineStats> => {
    setLoadError(null)
    try {
      return await window.electronAPI.engineStats(projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load engine stats.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleOpenEngineResult = async (
    projectId: string,
    relativePath: string,
    location?: { line?: number; column?: number }
  ) => {
    setLoadError(null)
    try {
      const result = await window.electronAPI.openProjectFileInEditor(projectId, relativePath, location)
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to open search result.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open search result.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRevealEngineResult = async (projectId: string, relativePath: string) => {
    setLoadError(null)
    try {
      const result = await window.electronAPI.openProjectFileInFolder(projectId, relativePath)
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to reveal search result.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reveal search result.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleOpenProjectTerminal = async (projectId: string) => {
    setLoadError(null)
    try {
      const result = await window.electronAPI.openProjectInTerminal(projectId)
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to open project terminal.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open project terminal.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleClearEngineSearchSession = async (projectId: string) => {
    setLoadError(null)
    try {
      const result = await window.electronAPI.clearEngineSearchSession(projectId)
      if (!result.success) {
        throw new Error('Failed to clear saved search.')
      }
      setEngineSearchSessions((prev) => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear saved search.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleStartContainer = async (containerId: string) => {
    await runContainerAction(
      () => window.electronAPI.startContainer(containerId),
      'Failed to start container.'
    )
  }

  const handleStopContainer = async (containerId: string) => {
    await runContainerAction(
      () => window.electronAPI.stopContainer(containerId),
      'Failed to stop container.'
    )
  }

  const handleRestartContainer = async (containerId: string) => {
    await runContainerAction(
      () => window.electronAPI.restartContainer(containerId),
      'Failed to restart container.'
    )
  }

  const handlePauseContainer = async (containerId: string) => {
    await runContainerAction(
      () => window.electronAPI.pauseContainer(containerId),
      'Failed to pause container.'
    )
  }

  const handleUnpauseContainer = async (containerId: string) => {
    await runContainerAction(
      () => window.electronAPI.unpauseContainer(containerId),
      'Failed to unpause container.'
    )
  }

  const handleRemoveContainer = async (containerId: string, force?: boolean) => {
    await runContainerAction(
      () => window.electronAPI.removeContainer(containerId, force),
      'Failed to remove container.'
    )
  }

  const handleRefreshContainers = async () => {
    setContainerError(null)
    try {
      const nextContainers = await window.electronAPI.getContainers()
      setContainers(nextContainers)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh containers.'
      setContainerError(message)
      throw new Error(message)
    }
  }

  const runContainerAction = async (action: () => Promise<{ success: boolean }>, fallbackMessage: string) => {
    setContainerError(null)
    try {
      await action()
      const nextContainers = await window.electronAPI.getContainers()
      setContainers(nextContainers)
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackMessage
      setContainerError(message)
      throw new Error(message)
    }
  }

  const handleViewContainerLogs = async (containerId: string) => {
    try {
      return await window.electronAPI.getContainerLogs(containerId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load container logs.'
      setContainerError(message)
      throw new Error(message)
    }
  }

  return (
    <>
      <AppShell
        navItems={navItemsWithCounts}
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
            <ProjectsSection
              projects={projects}
              isLoading={isLoading}
              error={loadError}
              preferences={preferences}
              onSavePreferences={handleSavePreferences}
              onUpdateProject={handleUpdateProject}
              onRemoveProject={handleRemoveProject}
              engineStatus={engineStatus}
              engineIndexes={engineIndexes}
              searchSessions={engineSearchSessions}
              onIndexProject={handleIndexProject}
              onOpenSearch={(projectId) => {
                setEngineSelectedProjectId(projectId)
                setActiveTab('engine')
              }}
            />
          )}
          {activeTab === 'engine' && (
            <EngineSection
              projects={projects}
              engineStatus={engineStatus}
              engineIndexes={engineIndexes}
              searchSessions={engineSearchSessions}
              selectedProjectId={engineSelectedProjectId}
              onSelectProject={setEngineSelectedProjectId}
              isLoading={isLoading}
              error={loadError}
              onRefreshStatus={refreshEngineState}
              onIndexProject={handleIndexProject}
              onSearch={handleEngineSearch}
              onLoadStats={handleLoadEngineStats}
              onOpenResult={handleOpenEngineResult}
              onRevealResult={handleRevealEngineResult}
              onOpenProjectTerminal={handleOpenProjectTerminal}
              onClearSearchSession={handleClearEngineSearchSession}
            />
          )}
          {activeTab === 'commands' && (
            <CommandsSection
              commands={commands}
              projects={projects}
              isLoading={isLoading}
              error={loadError}
              onRunCommand={handleRunCommand}
              onUpdateCommand={handleUpdateCommand}
              onRemoveCommand={handleRemoveCommand}
            />
          )}
          {activeTab === 'containers' && (
            <ContainersSection
              containers={containers}
              isLoading={isLoading}
              error={containerError}
              onStartContainer={handleStartContainer}
              onStopContainer={handleStopContainer}
              onRestartContainer={handleRestartContainer}
              onPauseContainer={handlePauseContainer}
              onUnpauseContainer={handleUnpauseContainer}
              onRemoveContainer={handleRemoveContainer}
              onViewLogs={handleViewContainerLogs}
              onRefreshContainers={handleRefreshContainers}
            />
          )}
          {activeTab === 'history' && (
            <HistorySection
              history={history}
              commands={commands}
              projects={projects}
              isLoading={isLoading}
              error={loadError}
              onStopRun={handleStopRun}
              onLoadOutput={handleLoadOutput}
              onClearHistory={handleClearHistory}
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
            <DialogDescription>Enter a local or WSL folder path to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="project-path">Project path</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="project-path"
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="Select a folder (Windows or WSL)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePickProject}
                  disabled={isPickingProject}
                >
                  {isPickingProject ? 'Opening...' : 'Browse'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePickWslProject}
                  disabled={isPickingProject}
                >
                  {isPickingProject ? 'Opening...' : 'Browse WSL'}
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedWslDistro}
                  onValueChange={handleWslDistroSelect}
                  disabled={isLoadingWslDistros || wslDistros.length === 0 || isPickingProject}
                >
                  <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue
                      placeholder={isLoadingWslDistros ? 'Loading WSL distros...' : 'No WSL distro found'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {wslDistros.length > 0 ? (
                      wslDistros.map((distro) => (
                        <SelectItem key={distro} value={distro} displayValue={distro}>
                          {distro}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No WSL distro detected.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  value={wslDistroInput}
                  onChange={(event) => setWslDistroInput(event.target.value)}
                  placeholder="WSL distro (e.g. Ubuntu-24.04)"
                  disabled={isPickingProject}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrefillWslPath}
                  disabled={isPickingProject}
                >
                  Prefill WSL Home
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use Prefill WSL Home to auto-fill `\\wsl.localhost\distro\home\` (manual distro entry is supported).</p>
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
              <Label htmlFor="command-project">Project</Label>
              <Select value={commandProjectId} onValueChange={handleProjectChange}>
                <SelectTrigger id="command-project" className="w-full">
                  <SelectValue placeholder="Global command (runs on any project)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_COMMAND_VALUE} displayValue="Global command">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>Global command</span>
                        <span className="text-xs text-muted-foreground">Runs on any project</span>
                      </div>
                    </div>
                  </SelectItem>
                  {projects.length > 0 ? (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id} displayValue={project.name}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{project.icon}</span>
                          <div className="flex flex-col">
                            <span>{project.name}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {project.path}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No projects added yet. Add a project first.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {commandProjectId !== GLOBAL_COMMAND_VALUE
                  ? `Bound to ${projects.find((p) => p.id === commandProjectId)?.name ?? 'project'}`
                  : 'Global commands can be run on any project'}
              </p>
            </div>
            {commandProjectId !== GLOBAL_COMMAND_VALUE && (
              <div className="space-y-2">
                <Label htmlFor="command-directory">Working Directory</Label>
                <Select
                  key={directorySelectKey}
                  value={commandWorkingDirectory}
                  onValueChange={handleWorkingDirectoryChange}
                >
                  <SelectTrigger id="command-directory" className="w-full">
                    <SelectValue placeholder="Project root" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__" displayValue="Project root">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span>Project root</span>
                          <span className="text-xs text-muted-foreground">
                            {projects.find((p) => p.id === commandProjectId)?.name}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                    {isLoadingDirectories ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin">⟳</span>
                        Loading directories...
                      </div>
                    ) : availableDirectories.length > 0 ? (
                      availableDirectories.map((dir) => (
                        <SelectItem key={dir} value={dir} displayValue={dir}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span>{dir}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No subdirectories found in project root.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Command will run in: {projects.find((p) => p.id === commandProjectId)?.name}
                  {commandWorkingDirectory && commandWorkingDirectory !== '__root__' ? ` / ${commandWorkingDirectory}` : ''}
                </p>
              </div>
            )}
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
