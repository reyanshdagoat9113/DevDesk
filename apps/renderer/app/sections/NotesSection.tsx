import { useEffect, useMemo, useState, useCallback } from 'react'
import { ClipboardList, CheckCircle, Bell, Edit3, Save, X, FileText, ChevronRight, StickyNote, Plus, Clock } from 'lucide-react'
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
          <div className="flex-1 overflow-auto px-2 py-2">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                Loading project notes...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive bg-destructive/5 rounded-lg border border-destructive/10">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-50">
                <FileText className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No projects available.</p>
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
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                        isActive 
                          ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                        hasNotes
                          ? "border-primary/30 bg-primary/5 text-primary shadow-sm" 
                          : "border-border/40 bg-muted/30 text-muted-foreground group-hover:border-border/60"
                      )}>
                        {hasNotes ? <StickyNote className="h-4 w-4" /> : project.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={cn(
                            "truncate text-sm font-bold leading-none",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {project.name}
                          </p>
                          {noteCount > 0 && (
                            <Badge variant="secondary" className="h-4 px-1 text-[8px] font-black uppercase tracking-tighter bg-muted/50 border-border/20">
                              {noteCount} UNIT{noteCount > 1 ? 'S' : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground/60 font-mono tracking-tighter">{project.path}</p>
                      </div>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary opacity-40 shrink-0" />}
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
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <FileText className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight truncate">{selectedProject.name}</CardTitle>
                    {isEditing && (
                      <Badge variant="outline" className="h-5 text-[9px] font-black uppercase tracking-[0.15em] bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse ml-2">
                        Drafting
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-[13px] text-muted-foreground/70">
                    Project-specific documentation, setup playbooks, and internal tracking.
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 gap-2 text-[11px] font-bold uppercase tracking-wider bg-background border-border/40 hover:bg-muted/50 transition-all ml-4"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Modify documentation
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5" />
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-4 gap-2 text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-primary/10"
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Persisting...' : 'Commit changes'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-0 p-8 pt-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NoteTab)} className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/10 border border-border/20 p-1 rounded-xl h-11 mb-8">
                  {TABS.map((tab) => {
                    const Icon = tab.icon
                    const count = getTabContentCount(tab.id)
                    const hasContent = count > 0
                    return (
                      <TabsTrigger 
                        key={tab.id} 
                        value={tab.id} 
                        className={cn(
                          "gap-2.5 rounded-lg transition-all font-bold uppercase tracking-widest text-[10px]",
                          "data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 opacity-60" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {hasContent && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[9px] font-black bg-primary/10 text-primary border-none">
                            {count}
                          </Badge>
                        )}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>

                {TABS.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id} className="flex-1 flex flex-col min-h-0 focus-visible:outline-none">
                    <div className="flex flex-col h-full gap-4">
                      <div className="flex items-center justify-between px-1">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-primary/40" />
                          {tab.description}
                        </Label>
                        {isEditing && (
                          <span className="text-[9px] font-bold text-muted-foreground/40 font-mono uppercase tracking-tighter">
                            {tab.id === 'todos' 
                              ? `${getContentCount(draft.todos)} LINE ITEMS`
                              : `${draft[tab.id === 'setup' ? 'setupSteps' : 'reminders'].length} CHARACTERS`
                            }
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex-1 relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-b from-primary/10 to-transparent rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                          <Textarea
                            value={draft[tab.id === 'setup' ? 'setupSteps' : tab.id === 'todos' ? 'todos' : 'reminders']}
                            onChange={(e) => updateDraft(tab.id === 'setup' ? 'setupSteps' : tab.id === 'todos' ? 'todos' : 'reminders', e.target.value)}
                            placeholder={tab.placeholder}
                            className="relative flex-1 resize-none font-mono text-[13px] leading-relaxed bg-muted/5 focus:bg-background transition-all duration-300 p-6 border-border/40 rounded-xl shadow-inner h-full"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 rounded-xl border border-border/40 bg-muted/5 p-8 overflow-auto shadow-inner">
                          {hasTabContent(tab.id) ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              {tab.id === 'todos' ? (
                                <div className="grid grid-cols-1 gap-3">
                                  {draft.todos.split('\n').filter(line => line.trim()).map((todo, idx) => (
                                    <div key={idx} className="flex items-start gap-4 group/todo p-3 rounded-lg border border-transparent hover:border-border/20 hover:bg-background/50 transition-all">
                                      <div className="mt-1 h-4 w-4 rounded border border-primary/20 bg-primary/5 group-hover/todo:border-primary/50 transition-colors flex items-center justify-center">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary opacity-0 group-hover/todo:opacity-40" />
                                      </div>
                                      <span className="text-[13px] leading-relaxed text-foreground/80 font-medium">{todo.trim()}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap text-[13px] leading-relaxed font-mono text-muted-foreground/90 bg-background/30 p-6 rounded-lg border border-border/10">
                                  <span className="text-emerald-500/40 select-none mr-2">DOC ::</span>
                                  {draft[tab.id === 'setup' ? 'setupSteps' : 'reminders']}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground/30">
                              <div className="p-4 rounded-full bg-muted/10 border border-border/10 border-dashed">
                                <tab.icon className="h-8 w-8 opacity-20" />
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-xs font-bold uppercase tracking-widest">Archive Empty</p>
                                <p className="text-[11px] font-medium opacity-60">No documentation units found in this category.</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-4 gap-2 text-[10px] font-bold uppercase tracking-widest mt-2 border-border/40"
                                onClick={() => setIsEditing(true)}
                              >
                                <Plus className="h-3 w-3" />
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

            <div className="border-t border-border/40 bg-muted/5 p-4">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                   {saveError ? (
                    <div className="flex items-center gap-2 text-[10px] text-destructive font-black uppercase tracking-widest">
                      <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping" />
                      Commit Error: {saveError}
                    </div>
                  ) : isEditing ? (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-1.5 bg-muted/20 px-2 py-0.5 rounded border border-border/20">
                        <kbd className="font-mono text-foreground">CTRL</kbd>
                        <span>+</span>
                        <kbd className="font-mono text-foreground">S</kbd>
                      </div>
                      <span>to persist draft</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                      <Clock className="h-3 w-3" />
                      Read-only mode
                    </div>
                  )}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/20">
                  DevDesk Note Engine v1.0
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/40 border-dashed bg-card/30 p-12 text-center shadow-sm">
            <div className="max-w-[240px] space-y-4 opacity-40">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 border-2 border-border/40 border-dashed">
                <StickyNote className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-widest">Documentation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Select a project to access its knowledge base, setup guides, and task lists.</p>
              </div>
            </div>
          </Card>
        )
      }
    />
  )
}
