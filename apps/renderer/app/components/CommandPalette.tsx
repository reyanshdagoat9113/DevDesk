import { useCallback, useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './ui/Command'
import {
  FolderKanban,
  Terminal,
  Container,
  History,
  Folder,
  Code,
  Play,
  Globe,
  ArrowLeft,
  File,
  Search,
  Database,
  Eraser,
  RefreshCcw,
  GitBranch,
  Send,
  Github,
  Monitor,
} from 'lucide-react'
import { VariablePromptModal } from './VariablePromptModal'
import { getContainerActionIcon, getStatusIcon } from './commandPaletteHelpers'
import type { TabValue } from '../lib/appShell'
import type {
  Project,
  Command,
  Container as ContainerType,
  RunStatus,
  CommandVariable,
  EngineIndexMeta,
  EngineSearchResult,
  EngineSearchSession,
  EngineStatus,
} from '../types'

type LightweightHistoryEntry = {
  id: string
  commandId: string
  projectId?: string
  status: RunStatus
  startTime: string
  endTime?: string
}

type PaletteItem = {
  id: string
  group: 'Navigation' | 'Projects' | 'Commands' | 'Containers' | 'History'
  title: string
  subtitle?: string
  keywords: string[]
  icon: React.ReactNode
  action: () => Promise<void> | void
  shortcut?: string
}

type PaletteMode =
  | { type: 'main' }
  | { type: 'projectPick'; command: Command }
  | { type: 'engineIndexProjectPick' }
  | { type: 'engineSearchProjectPick' }
  | { type: 'engineOpenProjectPick' }
  | { type: 'gitWorkspaceProjectPick' }
  | { type: 'gitCommitProjectPick' }
  | { type: 'gitPushProjectPick' }
  | { type: 'gitPullRequestProjectPick' }
  | { type: 'engineClearIndexProjectPick' }
  | { type: 'engineClearSearchProjectPick' }
  | { type: 'engineSearch'; project: Project }
  | { type: 'variableInput'; command: Command; projectId: string; inputs: CommandVariable[]; preview: string }

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  commands: Command[]
  containers: ContainerType[]
  history: LightweightHistoryEntry[]
  engineStatus: EngineStatus | null
  engineIndexes: Record<string, EngineIndexMeta>
  engineSearchSessions: Record<string, EngineSearchSession>
  onNavigate: (tab: TabValue) => void
  onOpenProjectInEditor: (projectId: string) => Promise<void>
  onOpenProjectInTerminal: (projectId: string) => Promise<void>
  onOpenProjectFolder: (projectId: string) => Promise<void>
  onOpenProjectEngine: (projectId: string) => void
  onIndexProject: (projectId: string) => Promise<unknown>
  onSearchProjectContent: (
    projectId: string,
    query: string,
    options?: { regex?: boolean; limit?: number }
  ) => Promise<EngineSearchResult>
  onPushProjectBranch?: (projectId: string) => Promise<unknown>
  onClearProjectIndex: (projectId: string) => Promise<void>
  onClearProjectSearchSession: (projectId: string) => Promise<void>
  onRunCommand: (commandId: string, projectId: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }>
  onStartContainer: (containerId: string) => Promise<void>
  onStopContainer: (containerId: string) => Promise<void>
  onRestartContainer: (containerId: string) => Promise<void>
  onPauseContainer: (containerId: string) => Promise<void>
  onUnpauseContainer: (containerId: string) => Promise<void>
  onError: (message: string) => void
  onOpenFileInEditor?: (projectId: string, relativePath: string, line?: number, column?: number) => Promise<void>
  onCreateTerminalSession?: (projectId?: string) => Promise<void>
}

export function CommandPalette({
  open,
  onOpenChange,
  projects,
  commands,
  containers,
  history,
  onNavigate,
  onOpenProjectInEditor,
  onOpenProjectInTerminal,
  onOpenProjectFolder,
  onOpenProjectEngine,
  onRunCommand,
  onStartContainer,
  onStopContainer,
  onRestartContainer,
  onPauseContainer,
  onUnpauseContainer,
  onError,
  onOpenFileInEditor,
  engineStatus,
  engineIndexes,
  engineSearchSessions,
  onIndexProject,
  onSearchProjectContent,
  onPushProjectBranch,
  onClearProjectIndex,
  onClearProjectSearchSession,
  onCreateTerminalSession,
}: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>({ type: 'main' })
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingEngineQuery, setPendingEngineQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset mode when palette opens
  useEffect(() => {
    if (open) {
      setMode({ type: 'main' })
      setSearchQuery('')
      setPendingEngineQuery('')
    }
  }, [open])

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (!isModK) return

      const target = e.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (isEditable) return

      e.preventDefault()
      onOpenChange(!open)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const runWithErrorHandling = useCallback(
    async (action: () => Promise<unknown> | unknown) => {
      try {
        setIsLoading(true)
        await action()
        onOpenChange(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        onError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [onOpenChange, onError]
  )

  // Handle running a command with variable support
  const runCommandWithVariables = useCallback(
    async (commandId: string, projectId: string) => {
      try {
        setIsLoading(true)
        const result = await onRunCommand(commandId, projectId)

        if (result.status === 'needs-input') {
          // Get the command details
          const command = commands.find((c) => c.id === commandId)
          if (!command) {
            onError('Command not found')
            return
          }

          // Switch to variable input mode
          const needsInput = result as { status: 'needs-input'; inputs: CommandVariable[]; preview: string }
          setMode({
            type: 'variableInput',
            command,
            projectId,
            inputs: needsInput.inputs,
            preview: needsInput.preview,
          })
          setSearchQuery('')
        } else {
          // Command started successfully
          onOpenChange(false)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run command'
        onError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [commands, onError, onOpenChange, onRunCommand]
  )

  // Handle variable submission from the modal
  const handleVariableSubmit = useCallback(
    async (values: Record<string, string>) => {
      if (mode.type !== 'variableInput') return

      try {
        setIsLoading(true)
        await onRunCommand(mode.command.id, mode.projectId, values)
        onOpenChange(false)
        setMode({ type: 'main' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run command'
        onError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [mode, onError, onOpenChange, onRunCommand]
  )

  // Handle variable input cancel
  const handleVariableCancel = useCallback(() => {
    setMode({ type: 'main' })
  }, [])

  const getProjectName = useCallback(
    (projectId?: string) => {
      if (!projectId) return 'Unknown project'
      return projects.find((p) => p.id === projectId)?.name ?? 'Unknown project'
    },
    [projects]
  )

  const getCommandName = useCallback(
    (commandId?: string) => {
      if (!commandId) return 'Unknown command'
      return commands.find((c) => c.id === commandId)?.name ?? 'Unknown command'
    },
    [commands]
  )

  const openEngineSearchFromMain = useCallback(() => {
    const initialQuery = searchQuery.trim()
    if (projects.length === 1) {
      setMode({ type: 'engineSearch', project: projects[0] })
      setSearchQuery(initialQuery)
      setPendingEngineQuery('')
      return
    }

    setPendingEngineQuery(initialQuery)
    setMode({ type: 'engineSearchProjectPick' })
    setSearchQuery('')
  }, [projects, searchQuery])

  const openEngineIndexFromMain = useCallback(() => {
    if (projects.length === 1) {
      void runWithErrorHandling(() => onIndexProject(projects[0].id))
      return
    }

    setMode({ type: 'engineIndexProjectPick' })
    setSearchQuery('')
  }, [onIndexProject, projects, runWithErrorHandling])

  const openEngineDashboardFromMain = useCallback(() => {
    if (projects.length === 1) {
      onOpenProjectEngine(projects[0].id)
      onOpenChange(false)
      return
    }

    setMode({ type: 'engineOpenProjectPick' })
    setSearchQuery('')
  }, [onOpenChange, onOpenProjectEngine, projects])

  const openGitWorkspaceFromMain = useCallback(() => {
    if (projects.length === 1) {
      onOpenProjectEngine(projects[0].id)
      onOpenChange(false)
      return
    }

    setMode({ type: 'gitWorkspaceProjectPick' })
    setSearchQuery('')
  }, [onOpenChange, onOpenProjectEngine, projects])

  const openGitCommitFromMain = useCallback(() => {
    if (projects.length === 1) {
      onOpenProjectEngine(projects[0].id)
      onOpenChange(false)
      return
    }

    setMode({ type: 'gitCommitProjectPick' })
    setSearchQuery('')
  }, [onOpenChange, onOpenProjectEngine, projects])

  const openGitPushFromMain = useCallback(() => {
    if (projects.length === 1 && onPushProjectBranch) {
      void runWithErrorHandling(() => onPushProjectBranch(projects[0].id))
      return
    }

    setMode({ type: 'gitPushProjectPick' })
    setSearchQuery('')
  }, [onPushProjectBranch, projects, runWithErrorHandling])

  const openGitPullRequestFromMain = useCallback(() => {
    if (projects.length === 1) {
      onOpenProjectEngine(projects[0].id)
      onOpenChange(false)
      return
    }

    setMode({ type: 'gitPullRequestProjectPick' })
    setSearchQuery('')
  }, [onOpenChange, onOpenProjectEngine, projects])

  const openEngineClearIndexFromMain = useCallback(() => {
    if (projects.length === 1) {
      void runWithErrorHandling(() => onClearProjectIndex(projects[0].id))
      return
    }

    setMode({ type: 'engineClearIndexProjectPick' })
    setSearchQuery('')
  }, [onClearProjectIndex, projects, runWithErrorHandling])

  const openEngineClearSearchFromMain = useCallback(() => {
    if (projects.length === 1) {
      void runWithErrorHandling(() => onClearProjectSearchSession(projects[0].id))
      return
    }

    setMode({ type: 'engineClearSearchProjectPick' })
    setSearchQuery('')
  }, [onClearProjectSearchSession, projects, runWithErrorHandling])

  const mainItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = []

    const navItems: { tab: TabValue; label: string; icon: React.ReactNode }[] = [
      { tab: 'projects', label: 'Go to Projects', icon: <FolderKanban className="h-4 w-4" /> },
      { tab: 'commands', label: 'Go to Commands', icon: <Terminal className="h-4 w-4" /> },
      { tab: 'engine', label: 'Go to Engine', icon: <Search className="h-4 w-4" /> },
      { tab: 'containers', label: 'Go to Containers', icon: <Container className="h-4 w-4" /> },
      { tab: 'history', label: 'Go to History', icon: <History className="h-4 w-4" /> },
      { tab: 'terminal', label: 'Go to Terminal', icon: <Monitor className="h-4 w-4" /> },
    ]

    for (const nav of navItems) {
      items.push({
        id: `nav-${nav.tab}`,
        group: 'Navigation',
        title: nav.label,
        keywords: [nav.tab, nav.label, 'go to', 'switch'],
        icon: nav.icon,
        action: () => runWithErrorHandling(() => onNavigate(nav.tab)),
      })
    }

    items.push({
      id: 'nav-engine-search',
      group: 'Navigation',
      title: 'Search Project with Performance Engine',
      subtitle: engineStatus?.available ? 'Search indexed code, filenames, and paths' : 'Performance engine unavailable',
      keywords: ['engine', 'search', 'code', 'files', 'index', 'find', 'open', 'navigate'],
      icon: <Search className="h-4 w-4" />,
      action: engineStatus?.available ? openEngineSearchFromMain : () => onError(engineStatus?.error || 'Performance engine is unavailable'),
    })

    items.push({
      id: 'nav-engine-index',
      group: 'Navigation',
      title: 'Index Project with Performance Engine',
      subtitle: engineStatus?.available ? 'Build or refresh the project index' : 'Performance engine unavailable',
      keywords: ['engine', 'index', 'reindex', 'performance', 'search'],
      icon: <Database className="h-4 w-4" />,
      action: engineStatus?.available ? openEngineIndexFromMain : () => onError(engineStatus?.error || 'Performance engine is unavailable'),
    })

    items.push({
      id: 'nav-engine-open',
      group: 'Navigation',
      title: 'Open Project in Performance Engine',
      subtitle: 'Open the full engine workspace for a project',
      keywords: ['engine', 'open', 'dashboard', 'stats', 'git', 'insights'],
      icon: <Search className="h-4 w-4" />,
      action: openEngineDashboardFromMain,
    })

    items.push({
      id: 'nav-git-workspace',
      group: 'Navigation',
      title: 'Open Git Workspace',
      subtitle: 'Review changes, commit, push, and file pull requests',
      keywords: ['git', 'workspace', 'engine', 'status', 'changes', 'commit', 'push', 'pull request'],
      icon: <GitBranch className="h-4 w-4" />,
      action: openGitWorkspaceFromMain,
    })

    items.push({
      id: 'nav-git-commit',
      group: 'Navigation',
      title: 'Commit All Changes',
      subtitle: 'Open the git workspace with the inline commit composer',
      keywords: ['git', 'commit', 'changes', 'workspace'],
      icon: <GitBranch className="h-4 w-4" />,
      action: openGitCommitFromMain,
    })

    items.push({
      id: 'nav-git-push',
      group: 'Navigation',
      title: 'Push Current Branch',
      subtitle: onPushProjectBranch ? 'Push the selected project branch now' : 'Git push unavailable',
      keywords: ['git', 'push', 'branch', 'remote'],
      icon: <Send className="h-4 w-4" />,
      action: onPushProjectBranch
        ? openGitPushFromMain
        : () => onError('Git push is unavailable.'),
    })

    items.push({
      id: 'nav-git-pr',
      group: 'Navigation',
      title: 'Create Pull Request',
      subtitle: 'Open the git workspace PR flow',
      keywords: ['git', 'pull request', 'pr', 'github'],
      icon: <Github className="h-4 w-4" />,
      action: openGitPullRequestFromMain,
    })

    items.push({
      id: 'nav-engine-clear-index',
      group: 'Navigation',
      title: 'Clear Project Engine Index',
      subtitle: 'Remove the saved local index for a project',
      keywords: ['engine', 'clear', 'index', 'reset', 'remove'],
      icon: <Eraser className="h-4 w-4" />,
      action: openEngineClearIndexFromMain,
    })

    items.push({
      id: 'nav-engine-clear-search',
      group: 'Navigation',
      title: 'Clear Saved Engine Search',
      subtitle: 'Remove the last saved engine search for a project',
      keywords: ['engine', 'clear', 'search', 'saved', 'reset'],
      icon: <RefreshCcw className="h-4 w-4" />,
      action: openEngineClearSearchFromMain,
    })

    if (onCreateTerminalSession) {
      items.push({
        id: 'nav-new-terminal',
        group: 'Navigation',
        title: 'New Integrated Terminal',
        subtitle: 'Open a new terminal session',
        keywords: ['terminal', 'new', 'shell', 'session', 'integrated'],
        icon: <Monitor className="h-4 w-4" />,
        action: () => runWithErrorHandling(async () => {
          onNavigate('terminal')
          await onCreateTerminalSession()
        }),
      })
    }
    // Sort projects: pinned first, then by name
    const sortedProjects = [...projects].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      if (a.isPinned && b.isPinned) {
        const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
        const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
        return bTime - aTime
      }
      return a.name.localeCompare(b.name)
    })

    for (const project of sortedProjects) {
      items.push({
        id: `project-${project.id}`,
        group: 'Projects',
        title: project.name,
        subtitle: project.path,
        keywords: [project.name, project.path, project.type, 'project', ...(project.isPinned ? ['pinned', 'star'] : [])],
        icon: <span className="text-lg">{project.icon}</span>,
        action: () => runWithErrorHandling(() => onNavigate('projects')),
      })
      items.push({
        id: `project-${project.id}-editor`,
        group: 'Projects',
        title: `Open ${project.name} in Editor`,
        subtitle: 'Open project in code editor',
        keywords: [project.name, 'editor', 'code', 'vscode', 'open'],
        icon: <Code className="h-4 w-4" />,
        action: () => runWithErrorHandling(() => onOpenProjectInEditor(project.id)),
      })
      items.push({
        id: `project-${project.id}-terminal`,
        group: 'Projects',
        title: `Open ${project.name} in Terminal`,
        subtitle: 'Open project in terminal',
        keywords: [project.name, 'terminal', 'shell', 'open'],
        icon: <Terminal className="h-4 w-4" />,
        action: () => runWithErrorHandling(() => onOpenProjectInTerminal(project.id)),
      })
      items.push({
        id: `project-${project.id}-folder`,
        group: 'Projects',
        title: `Open ${project.name} Folder`,
        subtitle: 'Open project folder in file manager',
        keywords: [project.name, 'folder', 'files', 'explorer', 'open'],
        icon: <Folder className="h-4 w-4" />,
        action: () => runWithErrorHandling(() => onOpenProjectFolder(project.id)),
      })
    }

    // Sort commands: pinned first, then by name
    const sortedCommands = [...commands].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      if (a.isPinned && b.isPinned) {
        const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
        const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
        return bTime - aTime
      }
      return a.name.localeCompare(b.name)
    })

    for (const command of sortedCommands) {
      const isGlobal = !command.projectId
      const projectName = isGlobal ? 'Global command' : getProjectName(command.projectId)

      items.push({
        id: `command-${command.id}`,
        group: 'Commands',
        title: `Run: ${command.name}`,
        subtitle: isGlobal ? 'Global command - select project to run' : projectName,
        keywords: [command.name, command.command, ...(command.tags ?? []), 'run', 'command', ...(command.isPinned ? ['pinned', 'star'] : [])],
        icon: isGlobal ? <Globe className="h-4 w-4" /> : <Play className="h-4 w-4" />,
        action: () => {
          if (isGlobal) {
            setMode({ type: 'projectPick', command })
            setSearchQuery('')
          } else {
            runCommandWithVariables(command.id, command.projectId!)
          }
        },
      })
    }

    for (const container of containers) {
      const baseKeywords = [container.name, container.image, container.state, 'container']

      if (container.state === 'stopped') {
        items.push({
          id: `container-${container.id}-start`,
          group: 'Containers',
          title: `Start ${container.name}`,
          subtitle: `${container.image} (${container.state})`,
          keywords: [...baseKeywords, 'start', 'run'],
          icon: getContainerActionIcon('start'),
          action: () => runWithErrorHandling(() => onStartContainer(container.id)),
        })
      } else if (container.state === 'running') {
        items.push({
          id: `container-${container.id}-stop`,
          group: 'Containers',
          title: `Stop ${container.name}`,
          subtitle: `${container.image} (${container.state})`,
          keywords: [...baseKeywords, 'stop', 'halt'],
          icon: getContainerActionIcon('stop'),
          action: () => runWithErrorHandling(() => onStopContainer(container.id)),
        })
        items.push({
          id: `container-${container.id}-restart`,
          group: 'Containers',
          title: `Restart ${container.name}`,
          subtitle: `${container.image} (${container.state})`,
          keywords: [...baseKeywords, 'restart', 'reload'],
          icon: getContainerActionIcon('restart'),
          action: () => runWithErrorHandling(() => onRestartContainer(container.id)),
        })
        items.push({
          id: `container-${container.id}-pause`,
          group: 'Containers',
          title: `Pause ${container.name}`,
          subtitle: `${container.image} (${container.state})`,
          keywords: [...baseKeywords, 'pause', 'suspend'],
          icon: getContainerActionIcon('pause'),
          action: () => runWithErrorHandling(() => onPauseContainer(container.id)),
        })
      } else if (container.state === 'paused') {
        items.push({
          id: `container-${container.id}-unpause`,
          group: 'Containers',
          title: `Unpause ${container.name}`,
          subtitle: `${container.image} (${container.state})`,
          keywords: [...baseKeywords, 'unpause', 'resume', 'continue'],
          icon: getContainerActionIcon('unpause'),
          action: () => runWithErrorHandling(() => onUnpauseContainer(container.id)),
        })
      }
    }

    const recentHistory = history.slice(0, 20)
    for (const entry of recentHistory) {
      const commandName = getCommandName(entry.commandId)
      const projectName = getProjectName(entry.projectId)
      const timeStr = new Date(entry.startTime).toLocaleString()

      items.push({
        id: `history-${entry.id}`,
        group: 'History',
        title: `${commandName} - ${projectName}`,
        subtitle: `${entry.status} • ${timeStr}`,
        keywords: [commandName, projectName, entry.status, 'history', 'run'],
        icon: getStatusIcon(entry.status),
        action: () => runWithErrorHandling(() => onNavigate('history')),
      })
    }

    return items
  }, [
    projects,
    commands,
    containers,
    history,
    onNavigate,
    onOpenProjectInEditor,
    onOpenProjectInTerminal,
    onOpenProjectFolder,
    runCommandWithVariables,
    onStartContainer,
    onStopContainer,
    onRestartContainer,
    onPauseContainer,
    onUnpauseContainer,
    runWithErrorHandling,
    getProjectName,
    getCommandName,
    openEngineSearchFromMain,
    openEngineIndexFromMain,
    openEngineDashboardFromMain,
    openGitWorkspaceFromMain,
    openGitCommitFromMain,
    openGitPushFromMain,
    openGitPullRequestFromMain,
    openEngineClearIndexFromMain,
    openEngineClearSearchFromMain,
    engineStatus,
    onPushProjectBranch,
    onError,
    onCreateTerminalSession,
  ])

  const projectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'projectPick') return []

    return projects.map((project) => ({
      id: `pick-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: project.path,
      keywords: [project.name, project.path, 'select', 'project'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => runCommandWithVariables(mode.command.id, project.id),
    }))
  }, [mode, projects, runCommandWithVariables])

  const engineIndexProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'engineIndexProjectPick') return []

    return projects.map((project) => ({
      id: `engine-index-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: engineIndexes[project.id]
        ? `Indexed ${new Date(engineIndexes[project.id].lastIndexed).toLocaleString()}`
        : 'Not indexed yet',
      keywords: [project.name, project.path, 'select', 'project', 'engine', 'index'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => runWithErrorHandling(() => onIndexProject(project.id)),
    }))
  }, [mode, projects, engineIndexes, runWithErrorHandling, onIndexProject])

  const engineSearchProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'engineSearchProjectPick') return []

    return projects.map((project) => ({
      id: `engine-search-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: engineIndexes[project.id]
        ? `Indexed ${new Date(engineIndexes[project.id].lastIndexed).toLocaleString()}`
        : 'Will auto-index on first search',
      keywords: [project.name, project.path, 'select', 'project', 'engine', 'search'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => {
        setMode({ type: 'engineSearch', project })
        setSearchQuery(pendingEngineQuery)
        setPendingEngineQuery('')
      },
    }))
  }, [mode, projects, engineIndexes, pendingEngineQuery])

  const engineOpenProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'engineOpenProjectPick') return []

    return projects.map((project) => ({
      id: `engine-open-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: 'Open engine workspace',
      keywords: [project.name, project.path, 'engine', 'open', 'dashboard'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () =>
        runWithErrorHandling(() => {
          onOpenProjectEngine(project.id)
        }),
    }))
  }, [mode, onOpenProjectEngine, projects, runWithErrorHandling])

  const gitProjectPickItems: PaletteItem[] = useMemo(() => {
    const buildItem = (project: Project, title: string, subtitle: string, action: () => Promise<void> | void): PaletteItem => ({
      id: `${mode.type}-${project.id}`,
      group: 'Projects',
      title,
      subtitle,
      keywords: [project.name, project.path, 'git', 'workspace', 'commit', 'push', 'pull request', 'changes'],
      icon: <span className="text-lg">{project.icon}</span>,
      action,
    })

    if (mode.type === 'gitWorkspaceProjectPick') {
      return projects.map((project) =>
        buildItem(project, project.name, 'Open git workspace', () =>
          runWithErrorHandling(() => {
            onOpenProjectEngine(project.id)
          })
        )
      )
    }

    if (mode.type === 'gitCommitProjectPick') {
      return projects.map((project) =>
        buildItem(project, project.name, 'Open workspace to write a commit message', () =>
          runWithErrorHandling(() => {
            onOpenProjectEngine(project.id)
          })
        )
      )
    }

    if (mode.type === 'gitPushProjectPick') {
      return projects.map((project) =>
        buildItem(project, project.name, 'Push current branch', () =>
          runWithErrorHandling(() => onPushProjectBranch ? onPushProjectBranch(project.id) : Promise.reject(new Error('Git push is unavailable.')))
        )
      )
    }

    if (mode.type === 'gitPullRequestProjectPick') {
      return projects.map((project) =>
        buildItem(project, project.name, 'Open workspace PR flow', () =>
          runWithErrorHandling(() => {
            onOpenProjectEngine(project.id)
          })
        )
      )
    }

    return []
  }, [mode.type, onOpenProjectEngine, onPushProjectBranch, projects, runWithErrorHandling])

  const engineClearIndexProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'engineClearIndexProjectPick') return []

    return projects.map((project) => ({
      id: `engine-clear-index-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: engineIndexes[project.id] ? 'Clear saved index' : 'No saved index',
      keywords: [project.name, project.path, 'engine', 'clear', 'index'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => runWithErrorHandling(() => onClearProjectIndex(project.id)),
    }))
  }, [mode, projects, engineIndexes, runWithErrorHandling, onClearProjectIndex])

  const engineClearSearchProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'engineClearSearchProjectPick') return []

    return projects.map((project) => ({
      id: `engine-clear-search-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: engineSearchSessions[project.id] ? 'Clear saved engine search' : 'No saved engine search',
      keywords: [project.name, project.path, 'engine', 'clear', 'search'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => runWithErrorHandling(() => onClearProjectSearchSession(project.id)),
    }))
  }, [mode, projects, runWithErrorHandling, onClearProjectSearchSession, engineSearchSessions])

  const currentItems = useMemo(() => {
    switch (mode.type) {
      case 'main':
        return mainItems
      case 'projectPick':
        return projectPickItems
      case 'engineIndexProjectPick':
        return engineIndexProjectPickItems
      case 'engineSearchProjectPick':
        return engineSearchProjectPickItems
      case 'engineOpenProjectPick':
        return engineOpenProjectPickItems
      case 'gitWorkspaceProjectPick':
      case 'gitCommitProjectPick':
      case 'gitPushProjectPick':
      case 'gitPullRequestProjectPick':
        return gitProjectPickItems
      case 'engineClearIndexProjectPick':
        return engineClearIndexProjectPickItems
      case 'engineClearSearchProjectPick':
        return engineClearSearchProjectPickItems
      case 'engineSearch':
        return []
      default:
        return mainItems
    }
  }, [
    mainItems,
    projectPickItems,
    engineIndexProjectPickItems,
    engineSearchProjectPickItems,
    engineOpenProjectPickItems,
    gitProjectPickItems,
    engineClearIndexProjectPickItems,
    engineClearSearchProjectPickItems,
    mode,
  ])

  const fuse = useMemo(() => {
    return new Fuse(currentItems, {
      keys: ['title', 'subtitle', 'keywords'],
      threshold: 0.4,
      includeScore: true,
    })
  }, [currentItems])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) return currentItems

    const results = fuse.search(query).map((r) => r.item)

    if (mode.type === 'main') {
      const quickFileSearchItem: PaletteItem = {
        id: 'nav-engine-search-query',
        group: 'Navigation',
        title: `Search "${query}" with Performance Engine`,
        subtitle: projects.length === 1 ? `Search in ${projects[0]?.name}` : 'Select project then search',
        keywords: ['engine', 'search', 'code', 'find', query],
        icon: <Search className="h-4 w-4" />,
        action: openEngineSearchFromMain,
      }

      return [quickFileSearchItem, ...results]
    }

    return results
  }, [fuse, searchQuery, currentItems, mode.type, projects, openEngineSearchFromMain])

  const groupedItems = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {
      Navigation: [],
      Projects: [],
      Commands: [],
      Containers: [],
      History: [],
    }

    for (const item of filteredItems) {
      if (groups[item.group]) {
        groups[item.group].push(item)
      }
    }

    return groups
  }, [filteredItems])

  const groupOrder: PaletteItem['group'][] = ['Navigation', 'Projects', 'Commands', 'Containers', 'History']

  const handleBack = () => {
    if (mode.type === 'engineSearch') {
      setMode({ type: 'engineSearchProjectPick' })
    } else {
      setMode({ type: 'main' })
    }
    setSearchQuery('')
  }

  const [fileSearchResults, setFileSearchResults] = useState<Array<{
    relativePath: string
    line?: number
    column?: number
    snippet?: string
    language?: string | null
    score: number
    matchCount: number
  }>>([])
  const [isSearchingFiles, setIsSearchingFiles] = useState(false)

  useEffect(() => {
    if (mode.type !== 'engineSearch') {
      setFileSearchResults([])
      return
    }

    const query = searchQuery.trim()
    if (!query) {
      setFileSearchResults([])
      return
    }

    setIsSearchingFiles(true)
    const timeoutId = setTimeout(async () => {
      try {
        const results = await onSearchProjectContent(mode.project.id, query, { limit: 50 })
        setFileSearchResults(
          results.results.map((result) => {
            const firstMatch = result.matches[0]
            return {
              relativePath: result.path,
              line: firstMatch?.line,
              column: firstMatch?.column,
              snippet: firstMatch?.snippet,
              language: result.language,
              score: result.score,
              matchCount: result.matches.length,
            }
          })
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed'
        onError(message)
        setFileSearchResults([])
      } finally {
        setIsSearchingFiles(false)
      }
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, mode, onError, onSearchProjectContent])

  const handleOpenFile = useCallback(
    (relativePath: string, line?: number, column?: number) => {
      if (mode.type !== 'engineSearch') return
      void runWithErrorHandling(async () => {
        if (onOpenFileInEditor) {
          await onOpenFileInEditor(mode.project.id, relativePath, line, column)
        } else {
          const result = await window.electronAPI.openFileInEditor(mode.project.id, relativePath, line, column)
          if (!result.success) {
            throw new Error(result.error || 'Failed to open file')
          }
        }
      })
    },
    [mode, onOpenFileInEditor, runWithErrorHandling]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={{ shouldFilter: false }}>
      <CommandInput
        placeholder={
          mode.type === 'projectPick'
            ? `Select project to run "${mode.command.name}"...`
            : mode.type === 'engineIndexProjectPick'
              ? 'Select a project to index...'
              : mode.type === 'engineSearchProjectPick'
                ? 'Select a project to search with the engine...'
                : mode.type === 'engineOpenProjectPick'
                  ? 'Select a project to open in the engine...'
                  : mode.type === 'engineClearIndexProjectPick'
                    ? 'Select a project index to clear...'
                    : mode.type === 'engineClearSearchProjectPick'
                      ? 'Select a saved search to clear...'
                : mode.type === 'engineSearch'
                  ? `Search indexed code in ${mode.project.name}...`
                : mode.type === 'variableInput'
                  ? `Enter variables for "${mode.command.name}"...`
                  : 'Search commands, projects, containers...'
        }
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            {mode.type !== 'engineSearch' ? <CommandEmpty>No results found.</CommandEmpty> : null}

            {(mode.type === 'projectPick' || mode.type === 'engineIndexProjectPick' || mode.type === 'engineSearchProjectPick' || mode.type === 'engineOpenProjectPick' || mode.type === 'gitWorkspaceProjectPick' || mode.type === 'gitCommitProjectPick' || mode.type === 'gitPushProjectPick' || mode.type === 'gitPullRequestProjectPick' || mode.type === 'engineClearIndexProjectPick' || mode.type === 'engineClearSearchProjectPick' || mode.type === 'engineSearch' || mode.type === 'variableInput') && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>Back</span>
                </CommandItem>
              </CommandGroup>
            )}

            {mode.type === 'engineSearch' ? (
              <>
                {isSearchingFiles ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : fileSearchResults.length > 0 ? (
                  <CommandGroup heading={`Engine Results (${fileSearchResults.length})`}>
                    {fileSearchResults.map((result) => (
                      <CommandItem
                        key={`${result.relativePath}:${result.line ?? 0}:${result.column ?? 0}`}
                        onSelect={() => handleOpenFile(result.relativePath, result.line, result.column)}
                        disabled={isLoading}
                      >
                        <span className="mr-2 flex items-center justify-center w-4 h-4">
                          <File className="h-4 w-4 text-gray-400" />
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate">{result.relativePath}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {result.line ? `Line ${result.line}` : 'Path match'}
                            {result.language ? ` • ${result.language}` : ''}
                            {result.matchCount > 0 ? ` • ${result.matchCount} matches` : ''}
                            {result.snippet ? ` • ${result.snippet}` : ''}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : searchQuery.trim() ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No indexed matches found</div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type to search indexed code in {mode.project.name}
                  </div>
                )}
              </>
            ) : (
              groupOrder.map((groupName) => {
                const items = groupedItems[groupName]
                if (!items || items.length === 0) return null

                return (
                  <CommandGroup key={groupName} heading={groupName}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          const result = item.action()
                          if (result instanceof Promise) {
                            result.catch(() => {
                              // Error handled by runWithErrorHandling
                            })
                          }
                        }}
                        disabled={isLoading}
                      >
                        <span className="mr-2 flex items-center justify-center w-4 h-4">
                          {item.icon}
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        {item.shortcut && (
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })
            )}
          </>
        )}
      </CommandList>

      {/* Variable Input Modal */}
      {mode.type === 'variableInput' && (
        <VariablePromptModal
          open={mode.type === 'variableInput'}
          onOpenChange={(open) => {
            if (!open) handleVariableCancel()
          }}
          variables={mode.inputs}
          commandPreview={mode.preview}
          onSubmit={handleVariableSubmit}
          onCancel={handleVariableCancel}
        />
      )}
    </CommandDialog>
  )
}
