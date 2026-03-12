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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/Select'
import { AppShell } from './layout/AppShell'
import { AutomationSection } from './sections/AutomationSection'
import { ContainersSection } from './sections/ContainersSection'
import { HistorySection } from './sections/HistorySection'
import { NotesSection } from './sections/NotesSection'
import { ProjectsSection } from './sections/ProjectsSection'
import type {
  AppPreferences,
  Command,
  CommandChain,
  CommandChainRunState,
  CommandTrigger,
  Container as ContainerType,
  CreateCommandChainInput,
  CreateCommandTriggerInput,
  CreateCommandInput,
  Project,
  ProjectNotes,
  RunHistoryEntry,
  TriggerConfirmationRequest,
} from './types'
import { CommandPalette } from './components/CommandPalette'
import { ThemeToggle } from './components/ThemeToggle'
import { ProjectDirectorySelector } from './components/ProjectDirectorySelector'

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
}

const GLOBAL_COMMAND_VALUE = '__global__'

function unwrapIpcErrorMessage(error: unknown, fallbackMessage: string) {
  const raw = error instanceof Error ? error.message : fallbackMessage
  let message = raw.trim()
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
  message = message.replace(/^Error:\s*/i, '')
  return message || fallbackMessage
}

function toUserContainerError(error: unknown, fallbackMessage: string) {
  const message = unwrapIpcErrorMessage(error, fallbackMessage)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('docker daemon') ||
    normalized.includes('failed to connect to the docker api') ||
    normalized.includes('cannot connect to the docker daemon') ||
    normalized.includes('dial unix') ||
    normalized.includes('error during connect')
  ) {
    return 'Docker is not running. Start Docker Desktop (or the Docker daemon) and try again.'
  }

  if (
    normalized.includes('docker cli not found') ||
    normalized.includes('command not found') ||
    normalized.includes('not recognized as an internal or external command')
  ) {
    return 'Docker CLI is not available. Install Docker Desktop and try again.'
  }

  return message
}

function upsertHistoryEntry(history: RunHistoryEntry[], entry: RunHistoryEntry): RunHistoryEntry[] {
  const existingIndex = history.findIndex((item) => item.id === entry.id)
  if (existingIndex === -1) {
    return [entry, ...history]
  }

  const next = [...history]
  next[existingIndex] = {
    ...next[existingIndex],
    ...entry,
    output: entry.output ?? next[existingIndex].output,
    resolvedCommand: entry.resolvedCommand ?? next[existingIndex].resolvedCommand,
  }
  return next
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('devdesk-theme')
    return (saved as 'light' | 'dark') || 'dark'
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('devdesk-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  const [activeTab, setActiveTab] = useState<TabValue>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [commands, setCommands] = useState<Command[]>([])
  const [chains, setChains] = useState<CommandChain[]>([])
  const [triggers, setTriggers] = useState<CommandTrigger[]>([])
  const [chainRuns, setChainRuns] = useState<Record<string, CommandChainRunState>>({})
  const [triggerConfirmations, setTriggerConfirmations] = useState<TriggerConfirmationRequest[]>([])
  const [containers, setContainers] = useState<ContainerType[]>([])
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [notes, setNotes] = useState<Record<string, ProjectNotes>>({})
  const [preferences, setPreferences] = useState<AppPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [containerError, setContainerError] = useState<string | null>(null)
  const [isContainersLoading, setIsContainersLoading] = useState(false)
  const [hasLoadedContainers, setHasLoadedContainers] = useState(false)
  const [hasAttemptedContainersLoad, setHasAttemptedContainersLoad] = useState(false)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isPickingProject, setIsPickingProject] = useState(false)
  const [wslDistros, setWslDistros] = useState<string[]>([])
  const [selectedWslDistro, setSelectedWslDistro] = useState('')
  const [wslDistroInput, setWslDistroInput] = useState('')
  const [isLoadingWslDistros, setIsLoadingWslDistros] = useState(false)
  const [showWslOptions, setShowWslOptions] = useState(false)

  const [commandDialogOpen, setCommandDialogOpen] = useState(false)
  const [commandName, setCommandName] = useState('')
  const [commandValue, setCommandValue] = useState('')
  const [commandDescription, setCommandDescription] = useState('')
  const [commandTags, setCommandTags] = useState('')
  const [commandProjectId, setCommandProjectId] = useState<string>(GLOBAL_COMMAND_VALUE)
  const [commandWorkingDirectory, setCommandWorkingDirectory] = useState<string>('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [isSavingCommand, setIsSavingCommand] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const title = useMemo(() => navItems.find((item) => item.value === activeTab)?.label ?? '', [activeTab])
  const actionLabel = actionLabels[activeTab]
  const navItemsWithCounts = useMemo(() => {
    const counts: Record<TabValue, number> = {
      projects: projects.length,
      commands: commands.length + chains.length + triggers.length,
      containers: containers.length,
      history: history.length,
      notes: projects.length,
    }
    return navItems.map((item) => ({
      ...item,
      count: counts[item.value],
    }))
  }, [projects.length, commands.length, chains.length, triggers.length, containers.length, history.length])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setContainerError(null)
    setContainers([])
    setChainRuns({})
    setTriggerConfirmations([])
    setHasLoadedContainers(false)
    setHasAttemptedContainersLoad(false)
    try {
      const [projectsResult, commandsResult, chainsResult, triggersResult, confirmationsResult, historyResult, preferencesResult] =
        await Promise.allSettled([
          window.electronAPI.getProjects(),
          window.electronAPI.getCommands(),
          window.electronAPI.getChains(),
          window.electronAPI.getTriggers(),
          window.electronAPI.getPendingTriggerConfirmations(),
          window.electronAPI.getRunHistory(),
          window.electronAPI.getPreferences(),
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

      if (chainsResult.status === 'fulfilled') {
        setChains(chainsResult.value)
      } else {
        errors.push(chainsResult.reason instanceof Error ? chainsResult.reason.message : 'Failed to load chains.')
        setChains([])
      }

      if (triggersResult.status === 'fulfilled') {
        setTriggers(triggersResult.value)
      } else {
        errors.push(triggersResult.reason instanceof Error ? triggersResult.reason.message : 'Failed to load triggers.')
        setTriggers([])
      }

      if (confirmationsResult.status === 'fulfilled') {
        setTriggerConfirmations(confirmationsResult.value)
      } else {
        setTriggerConfirmations([])
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

  const loadContainers = useCallback(async () => {
    setHasAttemptedContainersLoad(true)
    setIsContainersLoading(true)
    setContainerError(null)
    try {
      const nextContainers = await window.electronAPI.getContainers()
      setContainers(nextContainers)
      setHasLoadedContainers(true)
    } catch (error) {
      const message = toUserContainerError(error, 'Failed to load containers.')
      setContainerError(message)
      throw new Error(message)
    } finally {
      setIsContainersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const needsContainers = activeTab === 'containers' || activeTab === 'projects'
    if (!needsContainers || hasAttemptedContainersLoad || isContainersLoading) {
      return
    }
    void loadContainers()
  }, [activeTab, hasAttemptedContainersLoad, isContainersLoading, loadContainers])

  useEffect(() => {
    const unsubscribeStarted = window.electronAPI.onRunStarted((entry) => {
      setHistory((prev) =>
        upsertHistoryEntry(prev, {
          id: entry.id,
          commandId: entry.commandId,
          projectId: entry.projectId,
          status: 'running',
          startTime: entry.startTime,
          output: entry.output ?? '',
          resolvedCommand: entry.resolvedCommand,
        })
      )
    })

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

    const unsubscribeChainProgress = window.electronAPI.onChainProgress((payload) => {
      setChainRuns((prev) => ({
        ...prev,
        [payload.chainId]: payload,
      }))
    })

    const unsubscribeTriggerConfirmation = window.electronAPI.onTriggerConfirmationRequested((payload) => {
      setTriggerConfirmations((prev) => {
        if (prev.some((entry) => entry.id === payload.id)) {
          return prev
        }
        return [...prev, payload]
      })
    })

    return () => {
      unsubscribeStarted()
      unsubscribeOutput()
      unsubscribeStatus()
      unsubscribeChainProgress()
      unsubscribeTriggerConfirmation()
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

  const handleSetProjectLinkedContainers = async (projectId: string, linkedContainerNames: string[]) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.setProjectLinkedContainers(projectId, linkedContainerNames)
      setProjects((prev) => prev.map((project) => (project.id === projectId ? updated : project)))
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update linked containers.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRemoveProject = async (projectId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeProject(projectId)
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
      setCommands((prev) => prev.filter((command) => command.projectId !== projectId))
      setChains((prev) => prev.filter((chain) => chain.projectId !== projectId))
      setTriggers((prev) => prev.filter((trigger) => trigger.projectId !== projectId))
      setChainRuns((prev) => {
        const next = { ...prev }
        for (const chain of chains) {
          if (chain.projectId === projectId) {
            delete next[chain.id]
          }
        }
        return next
      })
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

  const handleToggleProjectPin = async (projectId: string) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.toggleProjectPin(projectId)
      setProjects((prev) => prev.map((project) => (project.id === projectId ? updated : project)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle project pin.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleToggleCommandPin = async (commandId: string) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.toggleCommandPin(commandId)
      setCommands((prev) => prev.map((command) => (command.id === commandId ? updated : command)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle command pin.'
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
    setCommandError(null)
    setIsSavingCommand(true)
    try {
      const tags = commandTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

      await handleCreateCommand({
        name: commandName,
        command: commandValue,
        description: commandDescription,
        tags: tags.length ? tags : undefined,
        projectId: commandProjectId === GLOBAL_COMMAND_VALUE ? undefined : commandProjectId,
        workingDirectory:
          commandWorkingDirectory === '__root__' || !commandWorkingDirectory.trim()
            ? undefined
            : commandWorkingDirectory,
      })

      // Reset form
      setCommandName('')
      setCommandValue('')
      setCommandDescription('')
      setCommandTags('')
      setCommandProjectId(GLOBAL_COMMAND_VALUE)
      setCommandWorkingDirectory('')
      setCommandDialogOpen(false)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'Failed to add command.')
    } finally {
      setIsSavingCommand(false)
    }
  }

  const handleCreateCommand = useCallback(async (input: CreateCommandInput) => {
    const normalizedName = input.name.trim()
    const normalizedCommand = input.command.trim()

    if (!normalizedName || !normalizedCommand) {
      throw new Error('Command name and command are required.')
    }

    const normalizedTags = input.tags
      ?.map((tag) => tag.trim())
      .filter(Boolean)

    const payload: CreateCommandInput = {
      name: normalizedName,
      command: normalizedCommand,
      description: input.description?.trim() || undefined,
      tags: normalizedTags?.length ? normalizedTags : undefined,
      projectId: input.projectId,
      workingDirectory: input.workingDirectory?.trim() || undefined,
    }

    setLoadError(null)
    try {
      const created = await window.electronAPI.addCommand(payload)
      setCommands((prev) => [created, ...prev])
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add command.'
      setLoadError(message)
      throw new Error(message)
    }
  }, [])

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

  const handleCreateChain = async (input: CreateCommandChainInput) => {
    setLoadError(null)
    try {
      const created = await window.electronAPI.addChain(input)
      setChains((prev) => [created, ...prev])
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create chain.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleUpdateChain = async (chainId: string, input: CreateCommandChainInput) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateChain(chainId, input)
      setChains((prev) => prev.map((chain) => (chain.id === chainId ? updated : chain)))
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update chain.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRemoveChain = async (chainId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeChain(chainId)
      setChains((prev) => prev.filter((chain) => chain.id !== chainId))
      setTriggers((prev) => prev.filter((trigger) => trigger.chainId !== chainId))
      setChainRuns((prev) => {
        const next = { ...prev }
        delete next[chainId]
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove chain.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRunChain = async (chainId: string, projectId?: string) => {
    setLoadError(null)
    try {
      return await window.electronAPI.runChain(chainId, projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run chain.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleCreateTrigger = async (input: CreateCommandTriggerInput) => {
    setLoadError(null)
    try {
      const created = await window.electronAPI.addTrigger(input)
      setTriggers((prev) => [created, ...prev])
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create trigger.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleUpdateTrigger = async (triggerId: string, input: CreateCommandTriggerInput) => {
    setLoadError(null)
    try {
      const updated = await window.electronAPI.updateTrigger(triggerId, input)
      setTriggers((prev) => prev.map((trigger) => (trigger.id === triggerId ? updated : trigger)))
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update trigger.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleRemoveTrigger = async (triggerId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeTrigger(triggerId)
      setTriggers((prev) => prev.filter((trigger) => trigger.id !== triggerId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove trigger.'
      setLoadError(message)
      throw new Error(message)
    }
  }

  const handleProjectSelected = useCallback((projectId: string) => {
    void window.electronAPI.notifyTriggerEvent('onProjectOpen', { projectId }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Failed to run project triggers.')
    })
  }, [])

  const handleRespondToTriggerConfirmation = async (requestId: string, approved: boolean) => {
    try {
      await window.electronAPI.respondToTriggerConfirmation(requestId, approved)
    } finally {
      setTriggerConfirmations((prev) => prev.filter((entry) => entry.id !== requestId))
    }
  }

  const handleRunCommand = async (commandId: string, projectId: string, variables?: Record<string, string>): Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }> => {
    setLoadError(null)
    try {
      const run = await window.electronAPI.runCommand(commandId, projectId, variables)
      
      // If needs input, return the result for the caller to handle
      if (run.status === 'needs-input') {
        return run as { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }
      }
      return run
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

  const handleRemoveHistoryEntry = async (runId: string) => {
    setLoadError(null)
    try {
      await window.electronAPI.removeRunHistory(runId)
      setHistory((prev) => prev.filter((entry) => entry.id !== runId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove history entry.'
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
    await loadContainers()
  }

  const handleStartDevStack = async (projectId: string) => {
    try {
      const result = await window.electronAPI.startProjectDevStack(projectId)
      await loadContainers()
      return result
    } catch (error) {
      const message = toUserContainerError(error, 'Failed to start dev stack.')
      setContainerError(message)
      throw new Error(message)
    }
  }

  const handleStopDevStack = async (projectId: string) => {
    try {
      const result = await window.electronAPI.stopProjectDevStack(projectId)
      await loadContainers()
      return result
    } catch (error) {
      const message = toUserContainerError(error, 'Failed to stop dev stack.')
      setContainerError(message)
      throw new Error(message)
    }
  }

  const runContainerAction = async (action: () => Promise<{ success: boolean }>, fallbackMessage: string) => {
    setContainerError(null)
    try {
      await action()
      await loadContainers()
    } catch (error) {
      const message = toUserContainerError(error, fallbackMessage)
      setContainerError(message)
      throw new Error(message)
    }
  }

  const containersSectionLoading =
    isLoading || isContainersLoading || (activeTab === 'containers' && !hasLoadedContainers && !containerError)

  const handleViewContainerLogs = async (containerId: string) => {
    try {
      return await window.electronAPI.getContainerLogs(containerId)
    } catch (error) {
      const message = toUserContainerError(error, 'Failed to load container logs.')
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
        themeToggle={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
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
              containers={containers}
              isLoading={isLoading}
              error={loadError}
              containersLoading={isContainersLoading && !hasLoadedContainers}
              containersError={containerError}
              preferences={preferences}
              onSavePreferences={handleSavePreferences}
              onUpdateProject={handleUpdateProject}
              onSetLinkedContainers={handleSetProjectLinkedContainers}
              onStartDevStack={handleStartDevStack}
              onStopDevStack={handleStopDevStack}
              onRefreshContainers={handleRefreshContainers}
              onRemoveProject={handleRemoveProject}
              onToggleProjectPin={handleToggleProjectPin}
              onSelectProject={handleProjectSelected}
            />
          )}
          {activeTab === 'commands' && (
            <AutomationSection
              commands={commands}
              chains={chains}
              triggers={triggers}
              projects={projects}
              chainRuns={chainRuns}
              isLoading={isLoading}
              error={loadError}
              onRunCommand={handleRunCommand}
              onUpdateCommand={handleUpdateCommand}
              onRemoveCommand={handleRemoveCommand}
              onToggleCommandPin={handleToggleCommandPin}
              onCreatePresetCommand={handleCreateCommand}
              onCreateChain={handleCreateChain}
              onUpdateChain={handleUpdateChain}
              onRemoveChain={handleRemoveChain}
              onRunChain={handleRunChain}
              onCreateTrigger={handleCreateTrigger}
              onUpdateTrigger={handleUpdateTrigger}
              onRemoveTrigger={handleRemoveTrigger}
              onOpenCreateCommand={() => setCommandDialogOpen(true)}
            />
          )}
          {activeTab === 'containers' && (
            <ContainersSection
              containers={containers}
              projects={projects}
              isLoading={containersSectionLoading}
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
              onRemoveEntry={handleRemoveHistoryEntry}
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

      <Dialog open={triggerConfirmations.length > 0} onOpenChange={() => undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Automation confirmation required</DialogTitle>
            <DialogDescription>
              {triggerConfirmations[0]
                ? `${triggerConfirmations[0].triggerName} wants to run ${triggerConfirmations[0].chainName}.`
                : 'A trigger is waiting for approval.'}
            </DialogDescription>
          </DialogHeader>
          {triggerConfirmations[0] ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p><span className="font-semibold">Event:</span> {triggerConfirmations[0].event}</p>
                {triggerConfirmations[0].projectName ? (
                  <p className="mt-1"><span className="font-semibold">Project:</span> {triggerConfirmations[0].projectName}</p>
                ) : null}
                {triggerConfirmations[0].containerNames?.length ? (
                  <p className="mt-1"><span className="font-semibold">Containers:</span> {triggerConfirmations[0].containerNames.join(', ')}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                triggerConfirmations[0]
                  ? void handleRespondToTriggerConfirmation(triggerConfirmations[0].id, false)
                  : undefined
              }
            >
              Skip
            </Button>
            <Button
              onClick={() =>
                triggerConfirmations[0]
                  ? void handleRespondToTriggerConfirmation(triggerConfirmations[0].id, true)
                  : undefined
              }
            >
              Run Trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription>Track a local folder or WSL project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-path">Project path</Label>
              <div className="flex gap-2">
                <Input
                  id="project-path"
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePickProject}
                  disabled={isPickingProject}
                >
                  Browse
                </Button>
              </div>
            </div>

            {!showWslOptions && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowWslOptions(true)}
              >
                Using WSL? Click here
              </Button>
            )}

            {showWslOptions && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">WSL Options</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
                    onClick={() => setShowWslOptions(false)}
                  >
                    Hide
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handlePickWslProject}
                  disabled={isPickingProject}
                >
                  Browse WSL Folder
                </Button>

                <div className="space-y-2">
                  <Label className="text-xs">Quick WSL Setup</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedWslDistro}
                      onValueChange={handleWslDistroSelect}
                      disabled={isLoadingWslDistros || wslDistros.length === 0}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue
                          placeholder={isLoadingWslDistros ? 'Loading...' : 'Select distro'}
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
                      placeholder="Or type distro name..."
                      className="flex-1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handlePrefillWslPath}
                    disabled={!selectedWslDistro && !wslDistroInput}
                  >
                    Prefill Home Directory
                  </Button>
                </div>
              </div>
            )}

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

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        projects={projects}
        commands={commands}
        containers={containers}
        history={history}
        onNavigate={setActiveTab}
        onOpenProjectInEditor={async (id) => {
          const result = await window.electronAPI.openProjectInEditor(id)
          if (!result.success) throw new Error(result.error || 'Failed to open editor')
        }}
        onOpenProjectInTerminal={async (id) => {
          const result = await window.electronAPI.openProjectInTerminal(id)
          if (!result.success) throw new Error(result.error || 'Failed to open terminal')
        }}
        onOpenProjectFolder={async (id) => {
          const result = await window.electronAPI.openProjectFolder(id)
          if (!result.success) throw new Error(result.error || 'Failed to open folder')
        }}
        onRunCommand={handleRunCommand}
        onStartContainer={handleStartContainer}
        onStopContainer={handleStopContainer}
        onRestartContainer={handleRestartContainer}
        onPauseContainer={handlePauseContainer}
        onUnpauseContainer={handleUnpauseContainer}
        onOpenFileInEditor={async (projectId, relativePath) => {
          const result = await window.electronAPI.openFileInEditor(projectId, relativePath)
          if (!result.success) throw new Error(result.error || 'Failed to open file')
        }}
        onError={(message) => setLoadError(message)}
      />

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
              <Label>Target Location</Label>
              <ProjectDirectorySelector
                projects={projects}
                selectedProjectId={commandProjectId}
                selectedDirectory={commandWorkingDirectory}
                onSelect={(projectId, directory) => {
                  setCommandProjectId(projectId || GLOBAL_COMMAND_VALUE)
                  setCommandWorkingDirectory(directory || '')
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {commandProjectId === GLOBAL_COMMAND_VALUE 
                  ? "Global commands can be run on any project from the Commands section."
                  : `This command will be bound to ${projects.find(p => p.id === commandProjectId)?.name}${commandWorkingDirectory ? ` / ${commandWorkingDirectory}` : ''}.`
                }
              </p>
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
