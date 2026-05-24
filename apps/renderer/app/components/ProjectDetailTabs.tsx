import type { ReactNode } from 'react'
import { Bug } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'

type TabValue = 'overview' | 'health' | 'bugs' | 'notes' | 'engine' | 'git'

interface ProjectDetailTabsProps {
  overviewPanel: ReactNode
  healthPanel: ReactNode
  notesPanel: ReactNode
  enginePanel: ReactNode | null
  gitPanel: ReactNode | null
  bugsPanel?: ReactNode
  defaultTab?: TabValue
}

export function ProjectDetailTabs({
  overviewPanel,
  healthPanel,
  notesPanel,
  enginePanel,
  gitPanel,
  bugsPanel,
  defaultTab,
}: ProjectDetailTabsProps) {
  const safeDefault: TabValue =
    defaultTab &&
    (defaultTab !== 'engine' || enginePanel !== null) &&
    (defaultTab !== 'git' || gitPanel !== null)
      ? defaultTab
      : 'overview'

  return (
    <Tabs defaultValue={safeDefault} className="flex flex-col h-full">
      <TabsList className="shrink-0 px-8 pt-6 pb-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="health">Health</TabsTrigger>
        <TabsTrigger value="bugs">Bugs</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        {enginePanel !== null && <TabsTrigger value="engine">Engine</TabsTrigger>}
        {gitPanel !== null && <TabsTrigger value="git">Git</TabsTrigger>}
      </TabsList>
      <TabsContent value="overview" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
        {overviewPanel}
      </TabsContent>
      <TabsContent value="health" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
        {healthPanel}
      </TabsContent>
      <TabsContent value="bugs" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
        {bugsPanel ?? <BugsPlaceholder />}
      </TabsContent>
      <TabsContent value="notes" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
        {notesPanel}
      </TabsContent>
      {enginePanel !== null && (
        <TabsContent value="engine" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
          {enginePanel}
        </TabsContent>
      )}
      {gitPanel !== null && (
        <TabsContent value="git" className="flex-1 overflow-auto p-8 pt-6 focus-visible:outline-none">
          {gitPanel}
        </TabsContent>
      )}
    </Tabs>
  )
}

function BugsPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Bug className="h-8 w-8 opacity-50" />
        <p className="text-sm">Bug tracking integration coming soon.</p>
      </div>
    </div>
  )
}
