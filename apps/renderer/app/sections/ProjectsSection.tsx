import { useEffect, useMemo, useState } from 'react'
import { Code2, ExternalLink, Pencil, Terminal, Trash2 } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Separator } from '../components/ui/Separator'
import { SectionLayout } from '../layout/SectionLayout'
import type { AppPreferences, Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function isWslPath(projectPath: string) {
  return /^\\\\wsl(?:\.localhost|\$)\\/i.test(projectPath)
}

const macEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'intellij', label: 'IntelliJ IDEA' },
  { id: 'sublime', label: 'Sublime Text' },
  { id: 'xcode', label: 'Xcode' },
  { id: 'custom', label: 'Custom command' },
]

const windowsEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'visual-studio', label: 'Visual Studio' },
  { id: 'custom', label: 'Custom command' },
]

const macTerminalOptions = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'iterm', label: 'iTerm' },
  { id: 'warp', label: 'Warp' },
  { id: 'hyper', label: 'Hyper' },
  { id: 'custom', label: 'Custom command' },
]

const windowsTerminalOptions = [
  { id: 'windows-terminal', label: 'Windows Terminal' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'cmd', label: 'Command Prompt' },
  { id: 'custom', label: 'Custom command' },
]

export function ProjectsSection({
  projects,
  isLoading,
  error,
  preferences,
  onSavePreferences,
  onUpdateProject,
  onRemoveProject,
}: {
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  preferences?: AppPreferences | null
  onSavePreferences?: (next: AppPreferences) => Promise<void>
  onUpdateProject?: (projectId: string, updates: { name: string }) => Promise<void>
  onRemoveProject?: (projectId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'folder' | 'editor' | 'terminal' | null>(null)
  const [prefsDraft, setPrefsDraft] = useState<AppPreferences | null>(preferences ?? null)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !projects.some((project) => project.id === selectedId)) {
      setSelectedId(projects[0].id)
    }
  }, [projects, selectedId])

  useEffect(() => {
    setActionError(null)
    setActionLoading(null)
  }, [selectedId])

  useEffect(() => {
    setPrefsDraft(preferences ?? null)
  }, [preferences])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedId) ?? projects[0]
  }, [projects, selectedId])

  useEffect(() => {
    setEditName(selectedProject?.name ?? '')
  }, [selectedProject?.id, selectedProject?.name])

  const handleOpen = async (action: 'folder' | 'editor' | 'terminal') => {
    if (!selectedProject || actionLoading) return
    setActionError(null)
    setActionLoading(action)
    try {
      const result =
        action === 'folder'
          ? await window.electronAPI.openProjectFolder(selectedProject.id)
          : action === 'editor'
            ? await window.electronAPI.openProjectInEditor(selectedProject.id)
            : await window.electronAPI.openProjectInTerminal(selectedProject.id)
      if (!result.success) {
        setActionError(result.error ?? 'Unable to open project.')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to open project.')
    } finally {
      setActionLoading(null)
    }
  }

  const savePreferences = async (next: AppPreferences) => {
    if (!onSavePreferences) return
    setPrefsError(null)
    setPrefsSaving(true)
    try {
      await onSavePreferences(next)
    } catch (error) {
      setPrefsError(error instanceof Error ? error.message : 'Failed to update preferences.')
    } finally {
      setPrefsSaving(false)
    }
  }

  const updatePreference = (partial: Partial<AppPreferences>, commit = true) => {
    if (!prefsDraft) return
    const next: AppPreferences = {
      editor: {
        id: partial.editor?.id ?? prefsDraft.editor.id,
        command: partial.editor?.command ?? prefsDraft.editor.command,
      },
      terminal: {
        id: partial.terminal?.id ?? prefsDraft.terminal.id,
        command: partial.terminal?.command ?? prefsDraft.terminal.command,
      },
    }
    setPrefsDraft(next)
    if (commit) {
      void savePreferences(next)
    }
  }

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
  const editorOptions = isMac ? macEditorOptions : windowsEditorOptions
  const terminalOptions = isMac ? macTerminalOptions : windowsTerminalOptions

  const handleSaveEdit = async () => {
    if (!selectedProject || !onUpdateProject || isSavingEdit) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Project name is required.')
      return
    }
    setEditError(null)
    setIsSavingEdit(true)
    try {
      await onUpdateProject(selectedProject.id, { name: trimmed })
      setEditDialogOpen(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update project.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRemoveProject = async () => {
    if (!selectedProject || !onRemoveProject || isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await onRemoveProject(selectedProject.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to remove project.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <SectionLayout
        list={
          <div className={panelClass}>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Projects</p>
            </div>
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  Loading projects...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                  {error}
                </div>
              ) : projects.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  No projects added yet.
                </div>
              ) : (
                projects.map((project) => {
                  const isActive = selectedProject?.id === project.id
                  const isWslProject = isWslPath(project.path)
                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedId(project.id)}
                      aria-pressed={isActive}
                      className={`group relative flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0 ${
                        isActive
                          ? "bg-accent/70 text-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-['']"
                          : 'hover:bg-accent/60'
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                        {project.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isWslProject ? (
                          <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wide">
                            🐧
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                          {project.type}
                        </Badge>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        }
        detail={
          <div className={`${panelClass} p-5`}>
            {selectedProject ? (
              <div className="flex h-full flex-col gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Details</p>
                    <h2 className="mt-3 text-lg font-semibold">{selectedProject.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedProject.path}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                    {isWslPath(selectedProject.path) ? (
                      <span className="rounded border border-border/80 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                        🐧 Linux
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</span>
                    <span className="text-foreground">{selectedProject.type}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() => handleOpen('editor')}
                    disabled={actionLoading !== null}
                  >
                    <Code2 className="h-4 w-4" />
                    {actionLoading === 'editor' ? 'Opening...' : 'Open in IDE'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleOpen('terminal')}
                    disabled={actionLoading !== null}
                  >
                    <Terminal className="h-4 w-4" />
                    {actionLoading === 'terminal' ? 'Opening...' : 'Open Terminal'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => handleOpen('folder')}
                    disabled={actionLoading !== null}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {actionLoading === 'folder' ? 'Opening...' : 'Open Folder'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={!onUpdateProject}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveProject}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
                {actionError ? (
                  <p className="text-xs text-destructive">{actionError}</p>
                ) : null}
                <Separator />
                <div className="mt-auto space-y-3 rounded-md border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Preferred Apps
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Choose what opens when you launch a project.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferred-editor">IDE / Editor</Label>
                    <select
                      id="preferred-editor"
                      className={selectClass}
                      value={prefsDraft?.editor.id ?? ''}
                      onChange={(event) =>
                        updatePreference({
                          editor: { id: event.target.value, command: prefsDraft?.editor.command },
                        })
                      }
                      disabled={!prefsDraft}
                    >
                      {editorOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {prefsDraft?.editor.id === 'custom' ? (
                      <div className="space-y-2">
                        <Input
                          value={prefsDraft.editor.command ?? ''}
                          onChange={(event) =>
                            updatePreference(
                              {
                                editor: { id: 'custom', command: event.target.value },
                              },
                              false
                            )
                          }
                          onBlur={() =>
                            updatePreference({ editor: { id: 'custom', command: prefsDraft?.editor.command } })
                          }
                          placeholder={
                            isMac ? 'open -a "Visual Studio Code" {path}' : 'code {path}'
                          }
                          disabled={!prefsDraft}
                        />
                        <p className="text-xs text-muted-foreground">Use {'{path}'} for the project folder.</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferred-terminal">Terminal</Label>
                    <select
                      id="preferred-terminal"
                      className={selectClass}
                      value={prefsDraft?.terminal.id ?? ''}
                      onChange={(event) =>
                        updatePreference({
                          terminal: { id: event.target.value, command: prefsDraft?.terminal.command },
                        })
                      }
                      disabled={!prefsDraft}
                    >
                      {terminalOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {prefsDraft?.terminal.id === 'custom' ? (
                      <div className="space-y-2">
                        <Input
                          value={prefsDraft.terminal.command ?? ''}
                          onChange={(event) =>
                            updatePreference(
                              {
                                terminal: { id: 'custom', command: event.target.value },
                              },
                              false
                            )
                          }
                          onBlur={() =>
                            updatePreference({ terminal: { id: 'custom', command: prefsDraft?.terminal.command } })
                          }
                          placeholder={isMac ? 'open -a "iTerm" {path}' : 'wt -d {path}'}
                          disabled={!prefsDraft}
                        />
                        <p className="text-xs text-muted-foreground">Use {'{path}'} for the project folder.</p>
                      </div>
                    ) : null}
                  </div>
                  {prefsError ? (
                    <p className="text-xs text-destructive">{prefsError}</p>
                  ) : prefsSaving ? (
                    <p className="text-xs text-muted-foreground">Saving preferences...</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a project to see details.
              </div>
            )}
          </div>
        }
      />
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (open && selectedProject) {
            setEditName(selectedProject.name)
          }
          if (!open) {
            setEditError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the project name shown in the sidebar and details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project name</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-path">Project path</Label>
              <Input id="edit-project-path" value={selectedProject?.path ?? ''} readOnly />
            </div>
            {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !onUpdateProject}>
              {isSavingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove project?</DialogTitle>
            <DialogDescription>
              This removes the project, its notes, and run history from DevDesk. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveProject} disabled={isDeleting || !onRemoveProject}>
              {isDeleting ? 'Removing...' : 'Remove project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
