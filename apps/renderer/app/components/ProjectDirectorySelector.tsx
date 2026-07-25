import * as React from 'react'
import { Check, ChevronRight, Folder, Globe, Search, ArrowLeft, Loader2 } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from './ui/Command'
import { Badge } from './ui/Badge'
import type { Project } from '../types'

interface ProjectDirectorySelectorProps {
  projects: Project[]
  selectedProjectId?: string
  selectedDirectory?: string
  onSelect: (projectId: string | undefined, directory?: string) => void
}

export function ProjectDirectorySelector({
  projects,
  selectedProjectId,
  selectedDirectory,
  onSelect,
}: ProjectDirectorySelectorProps) {
  const [step, setStep] = React.useState<'project' | 'directory'>(
    selectedProjectId && selectedProjectId !== '__global__' ? 'directory' : 'project'
  )
  const [currentProjectId, setCurrentProjectId] = React.useState<string | undefined>(
    selectedProjectId === '__global__' ? undefined : selectedProjectId
  )
  const [availableDirs, setAvailableDirectories] = React.useState<string[]>([])
  const [isLoadingDirs, setIsLoadingDirectories] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selectedProject = React.useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId]
  )

  const loadDirectories = React.useCallback(async (projectId: string, parentDir?: string) => {
    setIsLoadingDirectories(true)
    try {
      if (window.electronAPI.getProjectDirectories) {
        const dirs = await window.electronAPI.getProjectDirectories(projectId, parentDir)
        setAvailableDirectories(dirs)
      }
    } catch (error) {
      console.error('Failed to load directories:', error)
      setAvailableDirectories([])
    } finally {
      setIsLoadingDirectories(false)
    }
  }, [])

  React.useEffect(() => {
    if (currentProjectId && step === 'directory') {
      void loadDirectories(currentProjectId)
    }
  }, [currentProjectId, step, loadDirectories])

  const handleProjectSelect = (projectId: string | undefined) => {
    if (!projectId) {
      // Global
      setCurrentProjectId(undefined)
      onSelect(undefined, undefined)
      setSearch('')
    } else {
      setCurrentProjectId(projectId)
      setStep('directory')
      setSearch('')
    }
  }

  const handleDirectorySelect = (dir: string | undefined) => {
    onSelect(currentProjectId, dir === '__root__' ? undefined : dir)
    setSearch('')
  }

  const goBack = () => {
    setStep('project')
    setSearch('')
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      <Command className="rounded-none border-none" shouldFilter={true}>
        <div className="flex items-center border-b px-3">
          {step === 'directory' && (
            <button
              onClick={goBack}
              className="mr-2 h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={step === 'project' ? "Search projects..." : `Search directories in ${selectedProject?.name}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <CommandList className="max-h-[160px]">
          <CommandEmpty>No results found.</CommandEmpty>
          
          {step === 'project' && (
            <CommandGroup heading="Projects">
              <CommandItem
                onSelect={() => handleProjectSelect(undefined)}
                className="flex items-center gap-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-1 flex-col">
                  <span>Global Command</span>
                  <span className="text-[10px] text-muted-foreground">Available for all projects</span>
                </div>
                {!currentProjectId && <Check className="h-4 w-4 text-primary" />}
              </CommandItem>
              
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => handleProjectSelect(project.id)}
                  className="flex items-center gap-2"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold">
                    {project.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="truncate">{project.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate opacity-70">
                      {project.path}
                    </span>
                  </div>
                  {currentProjectId === project.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-30" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {step === 'directory' && selectedProject && (
            <CommandGroup heading={`Directories in ${selectedProject.name}`}>
              <CommandItem
                onSelect={() => handleDirectorySelect('__root__')}
                className="flex items-center gap-2"
              >
                <Folder className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-1 flex-col">
                  <span>Project Root</span>
                  <span className="text-[10px] text-muted-foreground opacity-70">
                    {selectedProject.path}
                  </span>
                </div>
                {!selectedDirectory && <Check className="h-4 w-4 text-primary" />}
              </CommandItem>

              {isLoadingDirs ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Loading directories...
                </div>
              ) : (
                availableDirs.map((dir) => (
                  <CommandItem
                    key={dir}
                    onSelect={() => handleDirectorySelect(dir)}
                    className="flex items-center gap-2"
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{dir}</span>
                    {selectedDirectory === dir && <Check className="h-4 w-4 text-primary" />}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}
        </CommandList>
      </Command>

      <div className="border-t bg-muted/20 px-3 py-2 flex items-center justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span>Selection:</span>
          {!currentProjectId ? (
            <Badge variant="outline" className="text-[9px] uppercase tracking-normal">Global</Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[9px] uppercase tracking-normal">{selectedProject?.name}</Badge>
              {selectedDirectory && (
                <>
                  <ChevronRight className="h-2 w-2" />
                  <Badge variant="outline" className="text-[9px] uppercase tracking-normal">{selectedDirectory}</Badge>
                </>
              )}
            </div>
          )}
        </div>
        {step === 'directory' && (
          <span>Esc to go back</span>
        )}
      </div>
    </div>
  )
}
