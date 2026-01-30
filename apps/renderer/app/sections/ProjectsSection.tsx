import { useEffect, useMemo, useState } from 'react'
import { Code2, ExternalLink, Terminal } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { SectionLayout } from '../layout/SectionLayout'
import type { AppPreferences, Project } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card'
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

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
}: {
  projects: Project[]
  isLoading?: boolean
  error?: string | null
  preferences?: AppPreferences | null
  onSavePreferences?: (next: AppPreferences) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'folder' | 'editor' | 'terminal' | null>(null)
  const [prefsDraft, setPrefsDraft] = useState<AppPreferences | null>(preferences ?? null)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)

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
  }, [preferences?.editor.id, preferences?.editor.command, preferences?.terminal.id, preferences?.terminal.command])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedId) ?? projects[0]
  }, [projects, selectedId])

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

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border px-4 py-3">
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
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isActive ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                      {project.type}
                    </Badge>
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
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Details</p>
                  <h2 className="mt-3 text-lg font-semibold">{selectedProject.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedProject.path}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
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
              </div>
              {actionError ? (
                <p className="text-xs text-destructive">{actionError}</p>
              ) : null}
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
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
                          updatePreference({
                            editor: { id: 'custom', command: event.target.value },
                          }, false)
                        }
                        onBlur={() => updatePreference({ editor: { id: 'custom', command: prefsDraft?.editor.command } })}
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
                          updatePreference({
                            terminal: { id: 'custom', command: event.target.value },
                          }, false)
                        }
                        onBlur={() => updatePreference({ terminal: { id: 'custom', command: prefsDraft?.terminal.command } })}
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
  )
}
