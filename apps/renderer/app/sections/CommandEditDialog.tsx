import { useEffect, useState } from 'react'
import { Variable } from 'lucide-react'
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
import { Badge } from '../components/ui/Badge'
import { Textarea } from '../components/ui/Textarea'
import { ProjectDirectorySelector } from '../components/ProjectDirectorySelector'
import { GLOBAL_COMMAND_VALUE } from '../lib/appShell'
import type { Command, CommandVariable, Project, UpdateCommandInput } from '../types'

export function CommandEditDialog({
  open,
  command,
  projects,
  onOpenChange,
  onUpdateCommand,
}: {
  open: boolean
  command: Command | null
  projects: Project[]
  onOpenChange: (open: boolean) => void
  onUpdateCommand?: (commandId: string, updates: UpdateCommandInput) => Promise<void>
}) {
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editWorkingDirectory, setEditWorkingDirectory] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [detectedVariables, setDetectedVariables] = useState<CommandVariable[]>([])

  useEffect(() => {
    if (!open || !command) {
      return
    }
    setEditName(command.name)
    setEditCommand(command.command)
    setEditDescription(command.description ?? '')
    setEditTags(command.tags?.join(', ') ?? '')
    setEditProjectId(command.projectId ?? '')
    setEditWorkingDirectory(command.workingDirectory ?? '')
    setEditError(null)
  }, [open, command])

  useEffect(() => {
    if (!open) {
      setDetectedVariables([])
      return
    }

    let cancelled = false
    const detect = async () => {
      if (!editCommand.trim()) {
        if (!cancelled) {
          setDetectedVariables([])
        }
        return
      }
      try {
        const vars = await window.electronAPI.detectCommandVariables(editCommand)
        if (!cancelled) {
          setDetectedVariables(vars)
        }
      } catch {
        if (!cancelled) {
          setDetectedVariables([])
        }
      }
    }
    void detect()

    return () => {
      cancelled = true
    }
  }, [editCommand, open])

  const handleSaveEdit = async () => {
    if (!command || !onUpdateCommand || isSavingEdit) return
    const trimmedName = editName.trim()
    const trimmedCommand = editCommand.trim()
    if (!trimmedName || !trimmedCommand) {
      setEditError('Command name and command are required.')
      return
    }
    setEditError(null)
    setIsSavingEdit(true)
    try {
      const trimmedTags = editTags.trim()
      const tags = trimmedTags
        ? trimmedTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []
      await onUpdateCommand(command.id, {
        name: trimmedName,
        command: trimmedCommand,
        description: editDescription.trim() || null,
        tags,
        projectId: editProjectId || null,
        workingDirectory: editWorkingDirectory.trim() || null,
      })
      onOpenChange(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update command.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          setEditError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit command</DialogTitle>
          <DialogDescription>
            Update the name, command, project, working directory, and metadata.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="edit-command-name">Name</Label>
            <Input
              id="edit-command-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Run tests"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-command-value">Command</Label>
            <Textarea
              id="edit-command-value"
              value={editCommand}
              onChange={(event) => setEditCommand(event.target.value)}
              placeholder="npm test -- --watch"
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-command-description">Description (optional)</Label>
            <Input
              id="edit-command-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Run tests in watch mode"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Location</Label>
            {open ? (
              <ProjectDirectorySelector
                key={command?.id ?? 'edit-command-location'}
                projects={projects}
                selectedProjectId={editProjectId || GLOBAL_COMMAND_VALUE}
                selectedDirectory={editWorkingDirectory || undefined}
                onSelect={(projectId, directory) => {
                  setEditProjectId(projectId || '')
                  setEditWorkingDirectory(directory || '')
                }}
              />
            ) : null}
            <p className="text-[10px] text-muted-foreground mt-1">
              {editProjectId
                ? `This command will be bound to ${projects.find((project) => project.id === editProjectId)?.name ?? 'the selected project'}${editWorkingDirectory ? ` / ${editWorkingDirectory}` : ''}.`
                : 'Global commands can be run on any project from the Commands section.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-command-tags">Tags (comma separated)</Label>
            <Input
              id="edit-command-tags"
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="test, watch"
            />
          </div>

          {detectedVariables.length > 0 && (
            <div className="space-y-2 rounded-md bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium">Detected Variables</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedVariables.map((variable) => (
                  <Badge
                    key={variable.name}
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {variable.name}
                    {variable.required && (
                      <span className="ml-0.5 text-destructive">*</span>
                    )}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Users will be prompted to enter values when running this command.
              </p>
            </div>
          )}

          {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSavingEdit}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={isSavingEdit || !onUpdateCommand}>
            {isSavingEdit ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
