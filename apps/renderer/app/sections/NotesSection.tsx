import { useEffect, useMemo, useState, useCallback } from 'react'
import { ClipboardList, CheckCircle, Bell, Edit3, Save, X, FileText } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Textarea } from '../components/ui/Textarea'
import { Separator } from '../components/ui/Separator'
import { Badge } from '../components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import { SectionLayout } from '../layout/SectionLayout'
import type { Project, ProjectNotes } from '../types'

const panelClass = 'flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm'

type NoteTab = 'setup' | 'todos' | 'reminders'

interface TabConfig {
  id: NoteTab
  label: string
  icon: typeof ClipboardList
  placeholder: string
  description: string
}

const TABS: TabConfig[] = [
  {
    id: 'setup',
    label: 'Setup',
    icon: ClipboardList,
    placeholder: 'Add setup steps, installation commands, or runbook instructions...',
    description: 'Setup steps, commands, and runbook notes',
  },
  {
    id: 'todos',
    label: 'Todos',
    icon: CheckCircle,
    placeholder: 'Add tasks, one per line...',
    description: 'Tasks and action items',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Bell,
    placeholder: 'Add important reminders or notes...',
    description: 'Important notes and reminders',
  },
]

function getContentCount(content: string): number {
  if (!content.trim()) return 0
  // Count non-empty lines for todos, characters for others
  return content.trim().split('\n').filter(line => line.trim()).length
}


export function NotesSection({
  projects,
  notes,
  isLoading,
  error,
  onSaveNotes,
}: {
  projects: Project[]
  notes: Record<string, ProjectNotes>
  isLoading?: boolean
  error?: string | null
  onSaveNotes?: (projectId: string, updates: Partial<ProjectNotes>) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null)
  const [activeTab, setActiveTab] = useState<NoteTab>('setup')
  const [draft, setDraft] = useState({ setupSteps: '', todos: '', reminders: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !projects.some((project) => project.id === selectedId)) {
      setSelectedId(projects[0].id)
    }
  }, [projects, selectedId])

  const selectedProject = useMemo(() => {
    if (!projects.length) return null
    return projects.find((project) => project.id === selectedId) ?? projects[0]
  }, [projects, selectedId])

  const selectedNotes = selectedProject ? notes[selectedProject.id] : null

  // Track original values for change detection
  const originalValues = useMemo(() => ({
    setupSteps: selectedNotes?.setupSteps ?? '',
    todos: selectedNotes?.todos ?? '',
    reminders: selectedNotes?.reminders ?? '',
  }), [selectedNotes?.setupSteps, selectedNotes?.todos, selectedNotes?.reminders])

  useEffect(() => {
    setDraft(originalValues)
    setIsEditing(false)
    setSaveError(null)
    setHasChanges(false)
  }, [originalValues])

  // Detect changes
  useEffect(() => {
    const changed = 
      draft.setupSteps !== originalValues.setupSteps ||
      draft.todos !== originalValues.todos ||
      draft.reminders !== originalValues.reminders
    setHasChanges(changed)
  }, [draft, originalValues])

  const handleSave = useCallback(async () => {
    if (!selectedProject || !onSaveNotes) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSaveNotes(selectedProject.id, draft)
      setIsEditing(false)
      setHasChanges(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save notes.')
    } finally {
      setIsSaving(false)
    }
  }, [selectedProject, onSaveNotes, draft])

  const handleCancel = useCallback(() => {
    setDraft(originalValues)
    setIsEditing(false)
    setSaveError(null)
  }, [originalValues])

  const updateDraft = useCallback((field: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }, [])

  const getTabContentCount = useCallback((tabId: NoteTab): number => {
    switch (tabId) {
      case 'setup': return getContentCount(draft.setupSteps)
      case 'todos': return getContentCount(draft.todos)
      case 'reminders': return getContentCount(draft.reminders)
    }
  }, [draft])

  const hasTabContent = useCallback((tabId: NoteTab): boolean => {
    return getTabContentCount(tabId) > 0
  }, [getTabContentCount])

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasChanges && !isSaving) {
          void handleSave()
        }
      }
      if (isEditing && e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, hasChanges, isSaving, handleSave, handleCancel])

  return (
    <SectionLayout
      list={
        <div className={panelClass}>
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                Loading notes...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No projects available.
              </div>
            ) : (
              projects.map((project) => {
                const isActive = selectedProject?.id === project.id
                const projectNotes = notes[project.id]
                const hasNotes = projectNotes && (
                  projectNotes.setupSteps.trim() ||
                  projectNotes.todos.trim() ||
                  projectNotes.reminders.trim()
                )
                const noteCount = projectNotes
                  ? (projectNotes.setupSteps.trim() ? 1 : 0) +
                    (projectNotes.todos.trim() ? 1 : 0) +
                    (projectNotes.reminders.trim() ? 1 : 0)
                  : 0

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
                    <div className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${
                      hasNotes ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {hasNotes ? <FileText className="h-4 w-4" /> : project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        {noteCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {noteCount}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{project.path}</p>
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
            <div className="flex h-full flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project Notes</p>
                  <h2 className="mt-2 text-lg font-semibold truncate">{selectedProject.name}</h2>
                  <p className="text-sm text-muted-foreground truncate">{selectedProject.path}</p>
                </div>
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Notes Content */}
              <div className="flex-1 flex flex-col min-h-0">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NoteTab)} className="flex flex-col h-full">
                  <TabsList className="grid w-full grid-cols-3">
                    {TABS.map((tab) => {
                      const Icon = tab.icon
                      const count = getTabContentCount(tab.id)
                      const hasContent = count > 0
                      return (
                        <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{tab.label}</span>
                          {hasContent && (
                            <Badge variant={activeTab === tab.id ? "default" : "secondary"} className="text-[10px] h-4 px-1 ml-0.5">
                              {count}
                            </Badge>
                          )}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>

                  {TABS.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="flex-1 flex flex-col min-h-0 mt-4">
                      <div className="flex flex-col h-full gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                            {tab.description}
                          </Label>
                          {isEditing && (
                            <span className="text-[10px] text-muted-foreground">
                              {tab.id === 'todos' 
                                ? `${getContentCount(draft.todos)} items`
                                : `${draft[tab.id === 'setup' ? 'setupSteps' : 'reminders'].length} chars`
                              }
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <Textarea
                            value={draft[tab.id === 'setup' ? 'setupSteps' : tab.id === 'todos' ? 'todos' : 'reminders']}
                            onChange={(e) => updateDraft(tab.id === 'setup' ? 'setupSteps' : tab.id === 'todos' ? 'todos' : 'reminders', e.target.value)}
                            placeholder={tab.placeholder}
                            className="flex-1 resize-none min-h-[200px] font-mono text-sm leading-relaxed"
                          />
                        ) : (
                          <div className="flex-1 rounded-md border border-border/60 bg-muted/30 p-4 overflow-auto">
                            {hasTabContent(tab.id) ? (
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                {tab.id === 'todos' ? (
                                  <ul className="space-y-1.5 list-none pl-0">
                                    {draft.todos.split('\n').filter(line => line.trim()).map((todo, idx) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground/30 mt-0.5" />
                                        <span className="text-sm">{todo.trim()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {draft[tab.id === 'setup' ? 'setupSteps' : 'reminders']}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                <tab.icon className="h-8 w-8 opacity-30" />
                                <p className="text-sm">No {tab.label.toLowerCase()} added yet</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => setIsEditing(true)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Add {tab.label}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {saveError ? (
                    <p className="text-xs text-destructive">{saveError}</p>
                  ) : isEditing ? (
                    <p className="text-xs text-muted-foreground">
                      {hasChanges ? 'Unsaved changes' : 'No changes'}
                      <span className="hidden sm:inline"> · Press Ctrl+S to save, Esc to cancel</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {hasTabContent('setup') || hasTabContent('todos') || hasTabContent('reminders')
                        ? `${[hasTabContent('setup') && 'Setup', hasTabContent('todos') && 'Todos', hasTabContent('reminders') && 'Reminders'].filter(Boolean).join(', ')} saved`
                        : 'No notes saved yet'
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a project to see notes</p>
            </div>
          )}
        </div>
      }
    />
  )
}
