import { useEffect, useMemo, useState } from 'react'
import { Code2, Pencil, Terminal, Trash2, FolderGit2, Monitor } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/Card'
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
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type { AppPreferences, Project } from '../types'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

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
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>
                <Badge variant="outline" className="text-[10px] font-medium">{projects.length}</Badge>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-2 py-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                  Loading projects...
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/10">
                  {error}
                </div>
              ) : projects.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                  <FolderGit2 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No projects added yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.map((project) => {
                    const isActive = selectedProject?.id === project.id
                    const isWslProject = isWslPath(project.path)
                    return (
                      <button
                        key={project.id}
                        onClick={() => setSelectedId(project.id)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                          isActive 
                            ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20" 
                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                          isActive 
                            ? "border-primary/30 bg-background text-primary" 
                            : "border-border/40 bg-background/50 text-muted-foreground group-hover:border-border/60"
                        )}>
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-none mb-1">{project.name}</p>
                          <p className="truncate text-[10px] opacity-60 font-mono tracking-tighter">{project.path}</p>
                        </div>
                        {isWslProject && (
                          <Badge variant="outline" className="h-4 px-1 text-[8px] font-bold border-blue-500/20 text-blue-500 bg-blue-500/5">
                            WSL
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        }
        detail={
          selectedProject ? (
            <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-md">
              <CardHeader className="border-b border-border/40 bg-muted/5 p-6 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl font-bold tracking-tight truncate">{selectedProject.name}</CardTitle>
                      <Badge variant="secondary" className="h-5 text-[10px] font-bold uppercase tracking-widest bg-muted/20 border-border/40">
                        {selectedProject.type}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 font-mono text-[11px] bg-muted/20 w-fit px-2 py-0.5 rounded border border-border/20">
                      {selectedProject.path}
                    </CardDescription>
                  </div>
                  {isWslPath(selectedProject.path) && (
                    <Badge variant="outline" className="gap-1.5 border-blue-500/20 text-blue-500 bg-blue-500/5 py-1 px-2">
                      <Monitor className="h-3 w-3" /> <span className="text-[10px] font-bold uppercase tracking-wider">WSL Environment</span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-auto p-8 pt-6">
                <div className="space-y-10">
                  {/* Quick Actions */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                      Execution Launchers
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('editor')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm group-hover:border-primary/20">
                          <Code2 className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Open in Editor</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('terminal')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm">
                          <Terminal className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Launch Terminal</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-24 flex-col gap-2.5 border-border/40 bg-muted/5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                        onClick={() => handleOpen('folder')}
                        disabled={actionLoading !== null}
                      >
                        <div className="p-2 rounded-full bg-background border border-border/40 shadow-sm">
                          <FolderGit2 className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold">Open Folder</span>
                      </Button>
                    </div>
                    {actionError && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                        {actionError}
                      </div>
                    )}
                  </div>

                  {/* Preferences */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                        Launch Configuration
                      </h3>
                      {prefsSaving && (
                        <div className="flex items-center gap-2 text-[10px] text-primary/70 font-semibold uppercase tracking-wider">
                          <div className="h-2 w-2 animate-spin rounded-full border border-primary border-r-transparent" />
                          Auto-saving
                        </div>
                      )}
                    </div>
                    
                    <div className="grid gap-8 md:grid-cols-2 p-5 rounded-xl border border-border/40 bg-muted/5">
                      <div className="space-y-3">
                        <Label htmlFor="preferred-editor" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Preferred IDE</Label>
                        <select
                          id="preferred-editor"
                          className={cn(selectClass, "bg-background shadow-sm")}
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
                        {prefsDraft?.editor.id === 'custom' && (
                          <div className="pt-1">
                            <Input
                              value={prefsDraft.editor.command ?? ''}
                              onChange={(event) =>
                                updatePreference(
                                  { editor: { id: 'custom', command: event.target.value } },
                                  false
                                )
                              }
                              onBlur={() =>
                                updatePreference({ editor: { id: 'custom', command: prefsDraft?.editor.command } })
                              }
                              placeholder={isMac ? 'open -a "App" {path}' : 'code {path}'}
                              className="h-8 text-[11px] font-mono bg-background"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="preferred-terminal" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Terminal Emulator</Label>
                        <select
                          id="preferred-terminal"
                          className={cn(selectClass, "bg-background shadow-sm")}
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
                        {prefsDraft?.terminal.id === 'custom' && (
                          <div className="pt-1">
                            <Input
                              value={prefsDraft.terminal.command ?? ''}
                              onChange={(event) =>
                                updatePreference(
                                  { terminal: { id: 'custom', command: event.target.value } },
                                  false
                                )
                              }
                              onBlur={() =>
                                updatePreference({ terminal: { id: 'custom', command: prefsDraft?.terminal.command } })
                              }
                              placeholder={isMac ? 'open -a "Term" {path}' : 'wt -d {path}'}
                              className="h-8 text-[11px] font-mono bg-background"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {prefsError && <p className="text-[11px] text-destructive bg-destructive/5 p-2 rounded border border-destructive/10">{prefsError}</p>}
                  </div>
                </div>
              </CardContent>

              <div className="border-t border-border/40 bg-muted/5 p-5">
                <div className="flex justify-between items-center px-1">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => setEditDialogOpen(true)}
                      disabled={!onUpdateProject}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!onRemoveProject}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center">
              <div className="max-w-[240px] space-y-4 opacity-40">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                  <FolderGit2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Workspace</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Select a project from the explorer list to manage execution environments and settings.</p>
                </div>
              </div>
            </Card>
          )
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
              <Input id="edit-project-path" value={selectedProject?.path ?? ''} readOnly className="bg-muted font-mono text-xs" />
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
