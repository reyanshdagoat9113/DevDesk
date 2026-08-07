import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, FileText } from 'lucide-react'
import { Button } from './ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs'
import { Textarea } from './ui/Textarea'
import { MarkdownPreview } from './MarkdownPreview'
import { ErrorState } from './ui/ErrorState'
import { LoadingState } from './ui/LoadingState'
import { StatusNotice } from './ui/StatusNotice'
import type { ProjectNotes } from '../types'
import { getTaskProgress, toggleTaskAtIndex } from '../lib/markdownUtils'

interface ProjectNotesPanelProps {
  projectId: string
  onLoadNotes?: (notes: ProjectNotes) => void
  onUpdateNotes?: (notes: ProjectNotes) => void
}

type NoteTab = 'setup' | 'todos' | 'reminders'
type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

const tabConfig: { id: NoteTab; label: string; value: keyof ProjectNotes }[] = [
  { id: 'setup', label: 'Setup', value: 'setupSteps' },
  { id: 'todos', label: 'Todos', value: 'todos' },
  { id: 'reminders', label: 'Reminders', value: 'reminders' },
]

export function ProjectNotesPanel({ projectId, onLoadNotes, onUpdateNotes }: ProjectNotesPanelProps) {
  const [notes, setNotes] = useState<ProjectNotes>({
    projectId,
    setupSteps: '',
    todos: '',
    reminders: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<NoteTab>('setup')
  const [previewTabs, setPreviewTabs] = useState<Record<NoteTab, boolean>>({
    setup: false,
    todos: false,
    reminders: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<ProjectNotes | null>(null)
  const saveInFlightRef = useRef(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.getProjectNotes(projectId)
      setNotes(result)
      setSaveState('idle')
      setSaveError(null)
      onLoadNotes?.(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project notes.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [projectId, onLoadNotes])

  useEffect(() => {
    void loadNotes()
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [loadNotes])

  const saveNotes = useCallback(
    async () => {
      if (saveInFlightRef.current || !pendingSaveRef.current) return
      const nextNotes = pendingSaveRef.current
      pendingSaveRef.current = null
      saveInFlightRef.current = true
      setSaving(true)
      setSaveState('saving')
      setSaveError(null)
      try {
        await window.electronAPI.updateProjectNotes(projectId, {
          setupSteps: nextNotes.setupSteps,
          todos: nextNotes.todos,
          reminders: nextNotes.reminders,
        })
        onUpdateNotes?.(nextNotes)
        setLastSavedAt(new Date())
      } catch (err) {
        pendingSaveRef.current ??= nextNotes
        const message = err instanceof Error ? err.message : 'Failed to save notes.'
        setSaveError(message)
        setSaveState('error')
        setSaving(false)
        saveInFlightRef.current = false
        return
      } finally {
        saveInFlightRef.current = false
      }

      if (pendingSaveRef.current) {
        void saveNotes()
      } else {
        setSaveState('saved')
        setSaving(false)
      }
    },
    [projectId, onUpdateNotes]
  )

  const handleChange = useCallback(
    (tab: NoteTab, value: string) => {
      setError(null)
      setSaveError(null)
      setSaveState('unsaved')
      setNotes((prev) => {
        const next = { ...prev, [tab === 'setup' ? 'setupSteps' : tab]: value }
        pendingSaveRef.current = next
        return next
      })

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          void saveNotes()
        }
      }, 300)
    },
    [saveNotes]
  )

  const togglePreview = useCallback((tab: NoteTab) => {
    setPreviewTabs((prev) => ({ ...prev, [tab]: !prev[tab] }))
  }, [])

  const handleTaskToggle = useCallback(
    (tab: NoteTab, taskIndex: number) => {
      const field = tabConfig.find((entry) => entry.id === tab)?.value
      if (!field) {
        return
      }

      const nextContent = toggleTaskAtIndex(notes[field], taskIndex)
      handleChange(tab, nextContent)
    },
    [handleChange, notes]
  )

  const retrySave = useCallback(() => {
    pendingSaveRef.current ??= notes
    void saveNotes()
  }, [notes, saveNotes])

  if (loading) {
    return <LoadingState label="Loading project notes" description="Loading project notes…" className="rounded-xl border border-border/40 bg-muted/5" />
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load project notes"
        description={error}
        onRetry={() => void loadNotes()}
        retryLabel="Retry loading notes"
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Project Notes
        </h3>
        <div className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {saveState === 'saving' ? 'Saving…' : null}
          {saveState === 'unsaved' ? 'Unsaved changes' : null}
          {saveState === 'saved' && lastSavedAt
            ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
        {saveState === 'error' && saveError ? (
          <StatusNotice
            tone="error"
            title="Notes were not saved"
            action={
              <Button size="sm" variant="outline" onClick={retrySave} disabled={saving}>
                Retry save
              </Button>
            }
            className="mb-4"
          >
            {saveError} Your changes are still in the editor.
          </StatusNotice>
        ) : null}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NoteTab)}>
            <TabsList className="mb-4">
              {tabConfig.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabConfig.map((tab) => {
              const isPreview = previewTabs[tab.id]
              const content = notes[tab.value]
              const taskProgress = getTaskProgress(content)

              return (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  <div className="space-y-3">
                    <div className="flex min-h-7 items-center justify-between gap-3">
                      {taskProgress.total > 0 ? (
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {taskProgress.completed} / {taskProgress.total} done
                        </div>
                      ) : (
                        <div />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2.5 text-[10px] font-semibold"
                        aria-pressed={isPreview}
                        onClick={() => togglePreview(tab.id)}
                      >
                        {isPreview ? (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            Edit
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </>
                        )}
                      </Button>
                    </div>

                    {isPreview ? (
                      <div className="min-h-[180px] rounded-md border border-border/40 bg-background/50 p-4">
                        {content.trim() ? (
                          <MarkdownPreview
                            source={content}
                            projectId={projectId}
                            onTaskToggle={(taskIndex) => handleTaskToggle(tab.id, taskIndex)}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Nothing to preview. Switch to Edit mode and add some markdown.
                          </p>
                        )}
                      </div>
                    ) : (
                      <Textarea
                        value={content}
                        onChange={(e) => handleChange(tab.id, e.target.value)}
                        placeholder={`Enter ${tab.label.toLowerCase()} in markdown...`}
                        className="min-h-[180px] font-mono text-xs leading-relaxed bg-background"
                      />
                    )}
                  </div>
                </TabsContent>
              )
            })}
        </Tabs>
      </div>
    </div>
  )
}
