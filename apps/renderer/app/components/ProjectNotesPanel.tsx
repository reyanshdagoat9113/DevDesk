import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, FileText, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs'
import { Textarea } from './ui/Textarea'
import { MarkdownPreview } from './MarkdownPreview'
import type { ProjectNotes } from '../types'

interface ProjectNotesPanelProps {
  projectId: string
  onLoadNotes?: (notes: ProjectNotes) => void
  onUpdateNotes?: (notes: ProjectNotes) => void
}

type NoteTab = 'setup' | 'todos' | 'reminders'

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<ProjectNotes | null>(null)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.getProjectNotes(projectId)
      setNotes(result)
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
    async (nextNotes: ProjectNotes) => {
      setSaving(true)
      try {
        await window.electronAPI.updateProjectNotes(projectId, {
          setupSteps: nextNotes.setupSteps,
          todos: nextNotes.todos,
          reminders: nextNotes.reminders,
        })
        onUpdateNotes?.(nextNotes)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save notes.'
        setError(message)
      } finally {
        setSaving(false)
      }
    },
    [projectId, onUpdateNotes]
  )

  const handleChange = useCallback(
    (tab: NoteTab, value: string) => {
      setError(null)
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
          void saveNotes(pendingSaveRef.current)
          pendingSaveRef.current = null
        }
      }, 300)
    },
    [saveNotes]
  )

  const togglePreview = useCallback((tab: NoteTab) => {
    setPreviewTabs((prev) => ({ ...prev, [tab]: !prev[tab] }))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading project notes...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Project Notes
        </h3>
        {saving && (
          <div className="flex items-center gap-2 text-[10px] text-primary/70 font-semibold uppercase tracking-wider">
            <div className="h-2 w-2 animate-spin rounded-full border border-primary border-r-transparent" />
            Saving
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/5 p-5">
        {error ? (
          <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive">
            {error}
          </div>
        ) : (
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

              return (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-end">
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
                          <MarkdownPreview source={content} />
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
        )}
      </div>
    </div>
  )
}
