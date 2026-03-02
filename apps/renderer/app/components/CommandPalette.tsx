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
  StickyNote,
  Folder,
  Code,
  Play,
  Square,
  RotateCw,
  Pause,
  PlayCircle,
  Globe,
  ArrowLeft,
  CornerDownLeft,
  FileText,
  File,
} from 'lucide-react'
import { VariablePromptModal } from './VariablePromptModal'
import type { Project, Command, Container as ContainerType, RunStatus, CommandVariable } from '../types'

type LightweightHistoryEntry = {
  id: string
  commandId: string
  projectId?: string
  status: RunStatus
  startTime: string
  endTime?: string
}

type TabValue = 'projects' | 'commands' | 'containers' | 'history' | 'notes'

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
  | { type: 'fileProjectPick' }
  | { type: 'fileSearch'; project: Project }
  | { type: 'variableInput'; command: Command; projectId: string; inputs: CommandVariable[]; preview: string }

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  commands: Command[]
  containers: ContainerType[]
  history: LightweightHistoryEntry[]
  onNavigate: (tab: TabValue) => void
  onOpenProjectInEditor: (projectId: string) => Promise<void>
  onOpenProjectInTerminal: (projectId: string) => Promise<void>
  onOpenProjectFolder: (projectId: string) => Promise<void>
  onRunCommand: (commandId: string, projectId: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }>
  onStartContainer: (containerId: string) => Promise<void>
  onStopContainer: (containerId: string) => Promise<void>
  onRestartContainer: (containerId: string) => Promise<void>
  onPauseContainer: (containerId: string) => Promise<void>
  onUnpauseContainer: (containerId: string) => Promise<void>
  onError: (message: string) => void
  onOpenFileInEditor?: (projectId: string, relativePath: string) => Promise<void>
}

function getStatusIcon(status: RunStatus) {
  switch (status) {
    case 'running':
      return <PlayCircle className="h-4 w-4 text-blue-500" />
    case 'success':
      return <CornerDownLeft className="h-4 w-4 text-green-500" />
    case 'failed':
      return <CornerDownLeft className="h-4 w-4 text-red-500" />
    case 'stopped':
      return <Square className="h-4 w-4 text-yellow-500" />
    default:
      return <History className="h-4 w-4" />
  }
}

function getContainerActionIcon(action: string) {
  switch (action) {
    case 'start':
      return <Play className="h-4 w-4" />
    case 'stop':
      return <Square className="h-4 w-4" />
    case 'restart':
      return <RotateCw className="h-4 w-4" />
    case 'pause':
      return <Pause className="h-4 w-4" />
    case 'unpause':
      return <PlayCircle className="h-4 w-4" />
    default:
      return <Container className="h-4 w-4" />
  }
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
  onRunCommand,
  onStartContainer,
  onStopContainer,
  onRestartContainer,
  onPauseContainer,
  onUnpauseContainer,
  onError,
  onOpenFileInEditor,
}: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>({ type: 'main' })
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingFileQuery, setPendingFileQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset mode when palette opens
  useEffect(() => {
    if (open) {
      setMode({ type: 'main' })
      setSearchQuery('')
      setPendingFileQuery('')
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

  const openFileSearchFromMain = useCallback(() => {
    const initialQuery = searchQuery.trim()
    if (projects.length === 1) {
      setMode({ type: 'fileSearch', project: projects[0] })
      setSearchQuery(initialQuery)
      setPendingFileQuery('')
      return
    }

    setPendingFileQuery(initialQuery)
    setMode({ type: 'fileProjectPick' })
    setSearchQuery('')
  }, [projects, searchQuery])

  const mainItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = []

    const navItems: { tab: TabValue; label: string; icon: React.ReactNode }[] = [
      { tab: 'projects', label: 'Go to Projects', icon: <FolderKanban className="h-4 w-4" /> },
      { tab: 'commands', label: 'Go to Commands', icon: <Terminal className="h-4 w-4" /> },
      { tab: 'containers', label: 'Go to Containers', icon: <Container className="h-4 w-4" /> },
      { tab: 'history', label: 'Go to History', icon: <History className="h-4 w-4" /> },
      { tab: 'notes', label: 'Go to Notes', icon: <StickyNote className="h-4 w-4" /> },
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
      id: 'nav-files',
      group: 'Navigation',
      title: 'Find File in Project',
      keywords: ['file', 'search', 'find', 'open', 'navigate'],
      icon: <FileText className="h-4 w-4" />,
      action: openFileSearchFromMain,
    })

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
        keywords: [project.name, project.path, project.type, 'project'],
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
        keywords: [command.name, command.command, ...(command.tags ?? []), 'run', 'command'],
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
    openFileSearchFromMain,
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

  const fileProjectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'fileProjectPick') return []

    return projects.map((project) => ({
      id: `file-pick-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: project.path,
      keywords: [project.name, project.path, 'select', 'project', 'file'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => {
        setMode({ type: 'fileSearch', project })
        setSearchQuery(pendingFileQuery)
        setPendingFileQuery('')
      },
    }))
  }, [mode, projects, pendingFileQuery])

  const currentItems = useMemo(() => {
    switch (mode.type) {
      case 'main':
        return mainItems
      case 'projectPick':
        return projectPickItems
      case 'fileProjectPick':
        return fileProjectPickItems
      case 'fileSearch':
        return []
      default:
        return mainItems
    }
  }, [mainItems, projectPickItems, fileProjectPickItems, mode])

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
        id: 'nav-files-query',
        group: 'Navigation',
        title: `Find file "${query}" in project`,
        subtitle: projects.length === 1 ? `Search in ${projects[0]?.name}` : 'Select project then search',
        keywords: ['file', 'search', 'find', query],
        icon: <FileText className="h-4 w-4" />,
        action: openFileSearchFromMain,
      }

      return [quickFileSearchItem, ...results]
    }

    return results
  }, [fuse, searchQuery, currentItems, mode.type, projects, openFileSearchFromMain])

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
    if (mode.type === 'fileSearch') {
      setMode({ type: 'fileProjectPick' })
    } else {
      setMode({ type: 'main' })
    }
    setSearchQuery('')
  }

  const [fileSearchResults, setFileSearchResults] = useState<Array<{ relativePath: string; kind: 'file' | 'dir' }>>([])
  const [isSearchingFiles, setIsSearchingFiles] = useState(false)

  useEffect(() => {
    if (mode.type !== 'fileSearch') {
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
        const results = await window.electronAPI.searchProjectFiles(mode.project.id, query, 50)
        setFileSearchResults(results)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed'
        onError(message)
        setFileSearchResults([])
      } finally {
        setIsSearchingFiles(false)
      }
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, mode, onError])

  const handleOpenFile = useCallback(
    (relativePath: string) => {
      if (mode.type !== 'fileSearch') return
      void runWithErrorHandling(async () => {
        if (onOpenFileInEditor) {
          await onOpenFileInEditor(mode.project.id, relativePath)
        } else {
          const result = await window.electronAPI.openFileInEditor(mode.project.id, relativePath)
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
            : mode.type === 'fileProjectPick'
              ? 'Select a project to search files...'
              : mode.type === 'fileSearch'
                ? `Search files in ${mode.project.name}...`
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
            {mode.type !== 'fileSearch' ? <CommandEmpty>No results found.</CommandEmpty> : null}

            {(mode.type === 'projectPick' || mode.type === 'fileProjectPick' || mode.type === 'fileSearch' || mode.type === 'variableInput') && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>Back</span>
                </CommandItem>
              </CommandGroup>
            )}

            {mode.type === 'fileSearch' ? (
              <>
                {isSearchingFiles ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : fileSearchResults.length > 0 ? (
                  <CommandGroup heading={`Files (${fileSearchResults.length})`}>
                    {fileSearchResults.map((result) => (
                      <CommandItem
                        key={result.relativePath}
                        onSelect={() => handleOpenFile(result.relativePath)}
                        disabled={isLoading}
                      >
                        <span className="mr-2 flex items-center justify-center w-4 h-4">
                          {result.kind === 'dir' ? (
                            <Folder className="h-4 w-4 text-blue-400" />
                          ) : (
                            <File className="h-4 w-4 text-gray-400" />
                          )}
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="truncate">{result.relativePath}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : searchQuery.trim() ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No files found</div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type to search files in {mode.project.name}
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
