import { useEffect, useMemo, useState, useCallback } from 'react'
import { ClipboardList, CheckCircle, Bell, Edit3, Save, X, FileText, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/ui/Card'
import { SectionLayout } from '../layout/SectionLayout'
import { cn } from '../../lib/utils'
import type { Project, ProjectNotes } from '../types'

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
        <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
          <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading notes...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No projects available.
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => {
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
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-all",
                        isActive 
                          ? "bg-primary/10 shadow-sm" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                        hasNotes
                          ? "border-primary/20 bg-primary/10 text-primary" 
                          : "border-border/40 bg-muted/30 text-muted-foreground"
                      )}>
                        {hasNotes ? <FileText className="h-4 w-4" /> : project.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "truncate text-sm font-medium",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {project.name}
                          </p>
                          {noteCount > 0 && (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                              {noteCount}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground/70">{project.path}</p>
                      </div>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary opacity-50" />}
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
          <Card className="flex h-full flex-col overflow-hidden border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{selectedProject.name}</CardTitle>
                    {isEditing && <Badge variant="outline" className="text-[10px] bg-background/50 animate-pulse">Editing</Badge>}
                  </div>
                  <CardDescription>
                    Project Notes & Documentation
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Notes
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
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
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-0 p-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NoteTab)} className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/20">
                  {TABS.map((tab) => {
                    const Icon = tab.icon
                    const count = getTabContentCount(tab.id)
                    const hasContent = count > 0
                    return (
                      <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                        <Icon className="h-3.5 w-3.5 opacity-70" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {hasContent && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                            {count}
                          </Badge>
                        )}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>

                {TABS.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id} className="flex-1 flex flex-col min-h-0 mt-4 focus-visible:outline-none">
                    <div className="flex flex-col h-full gap-3">
                      <div className="flex items-center justify-between px-1">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          {tab.description}
                        </Label>
                        {isEditing && (
                          <span className="text-[10px] text-muted-foreground font-mono">
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
                          className="flex-1 resize-none font-mono text-sm leading-relaxed bg-background/50 focus:bg-background transition-colors p-4"
                        />
                      ) : (
                        <div className="flex-1 rounded-md border border-border/40 bg-muted/10 p-4 overflow-auto">
                          {hasTabContent(tab.id) ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              {tab.id === 'todos' ? (
                                <ul className="space-y-2 list-none pl-0 m-0">
                                  {draft.todos.split('\n').filter(line => line.trim()).map((todo, idx) => (
                                    <li key={idx} className="flex items-start gap-3 group">
                                      <div className="mt-1 h-3 w-3 rounded-[3px] border border-primary/30 group-hover:border-primary/60 transition-colors" />
                                      <span className="text-sm leading-relaxed text-foreground/90">{todo.trim()}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-muted-foreground/90">
                                  {draft[tab.id === 'setup' ? 'setupSteps' : 'reminders']}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/40">
                              <tab.icon className="h-10 w-10 opacity-20" />
                              <p className="text-sm font-medium">No {tab.label.toLowerCase()} added yet</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs mt-2"
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
            </CardContent>

            <div className="border-t border-border/40 bg-muted/10 p-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2">
                <div className="flex items-center gap-2">
                   {saveError ? (
                    <span className="text-destructive font-medium">{saveError}</span>
                  ) : isEditing ? (
                    <span>Press <kbd className="font-sans font-semibold text-foreground">Ctrl+S</kbd> to save</span>
                  ) : (
                    <span>Last updated recently</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/40 bg-card/50 p-6 text-center shadow-sm">
            <div className="space-y-2">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium">No project selected</h3>
              <p className="text-sm text-muted-foreground">Select a project to view or edit notes.</p>
            </div>
          </Card>
        )
      }
    />
  )
}
