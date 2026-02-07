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
} from 'lucide-react'
import type { Project, Command, Container as ContainerType, RunStatus } from '../types'

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
  onRunCommand: (commandId: string, projectId: string) => Promise<void>
  onStartContainer: (containerId: string) => Promise<void>
  onStopContainer: (containerId: string) => Promise<void>
  onRestartContainer: (containerId: string) => Promise<void>
  onPauseContainer: (containerId: string) => Promise<void>
  onUnpauseContainer: (containerId: string) => Promise<void>
  onError: (message: string) => void
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
}: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>({ type: 'main' })
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset mode when palette opens
  useEffect(() => {
    if (open) {
      setMode({ type: 'main' })
      setSearchQuery('')
    }
  }, [open])

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (!isModK) return

      // Don't trigger when typing in editable elements
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
    async (action: () => Promise<void> | void) => {
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

  // Build palette items
  const mainItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = []

    // Navigation items
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

    // Project items
    for (const project of projects) {
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

    // Command items
    for (const command of commands) {
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
            runWithErrorHandling(() => onRunCommand(command.id, command.projectId!))
          }
        },
      })
    }

    // Container items
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

    // History items (last 20, without output)
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
    onRunCommand,
    onStartContainer,
    onStopContainer,
    onRestartContainer,
    onPauseContainer,
    onUnpauseContainer,
    runWithErrorHandling,
    getProjectName,
    getCommandName,
  ])

  // Build project pick items (for global commands)
  const projectPickItems: PaletteItem[] = useMemo(() => {
    if (mode.type !== 'projectPick') return []
    
    return projects.map((project) => ({
      id: `pick-project-${project.id}`,
      group: 'Projects',
      title: project.name,
      subtitle: project.path,
      keywords: [project.name, project.path, 'select', 'project'],
      icon: <span className="text-lg">{project.icon}</span>,
      action: () => runWithErrorHandling(() => onRunCommand(mode.command.id, project.id)),
    }))
  }, [mode, projects, onRunCommand, runWithErrorHandling])

  const currentItems = mode.type === 'main' ? mainItems : projectPickItems

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(currentItems, {
      keys: ['title', 'subtitle', 'keywords'],
      threshold: 0.4,
      includeScore: true,
    })
  }, [currentItems])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return currentItems
    const results = fuse.search(searchQuery)
    return results.map((r) => r.item)
  }, [fuse, searchQuery, currentItems])

  // Group items
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
    setMode({ type: 'main' })
    setSearchQuery('')
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          mode.type === 'projectPick'
            ? `Select project to run "${mode.command.name}"...`
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
            <CommandEmpty>No results found.</CommandEmpty>
            
            {mode.type === 'projectPick' && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>Back to main menu</span>
                </CommandItem>
              </CommandGroup>
            )}
            
            {groupOrder.map((groupName) => {
              const items = groupedItems[groupName]
              if (!items || items.length === 0) return null
              
              return (
                <CommandGroup key={groupName} heading={groupName}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => {
                        // Execute action and handle mode changes
                        const result = item.action()
                        if (result instanceof Promise) {
                          result.catch(() => {
                            // Error is handled by runWithErrorHandling
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
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
