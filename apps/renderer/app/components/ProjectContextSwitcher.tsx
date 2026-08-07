import { FolderGit2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'

export interface ProjectContextOption {
  id: string
  name: string
  path: string
}

interface ProjectContextSwitcherProps {
  projects: ReadonlyArray<ProjectContextOption>
  value?: string | null
  onValueChange?: (projectId: string) => void
}

export function ProjectContextSwitcher({
  projects,
  value,
  onValueChange,
}: ProjectContextSwitcherProps) {
  const selectedProject = projects.find((project) => project.id === value) ?? projects[0]

  if (projects.length === 0) {
    return (
      <div
        className="flex min-w-0 items-center gap-2 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground"
        role="status"
      >
        <FolderGit2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">No project selected</span>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Project context</span>
      <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Select
        value={selectedProject?.id ?? ''}
        onValueChange={onValueChange}
      >
        <SelectTrigger
          aria-label="Active project context"
          title={selectedProject ? `${selectedProject.name} — ${selectedProject.path}` : 'Select project context'}
          className="h-8 min-w-0 w-[min(38vw,280px)] border-border/60 bg-background/50 px-2.5 text-xs shadow-none"
        >
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent align="start">
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id} displayValue={project.name}>
              <div className="min-w-0 py-0.5">
                <p className="truncate text-sm font-medium">{project.name}</p>
                <p className="max-w-[260px] truncate font-mono text-[10px] text-muted-foreground">
                  {project.path}
                </p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
