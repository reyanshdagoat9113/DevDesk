import type { ReactNode } from 'react'
import { Bug } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'

type TabValue = 'overview' | 'health' | 'bugs' | 'notes' | 'llm' | 'engine' | 'git'

const tabItems: ReadonlyArray<{ value: TabValue; label: string; description: string }> = [
  { value: 'overview', label: 'Overview', description: 'Project summary and actions' },
  { value: 'health', label: 'Health checks', description: 'Dependencies and setup diagnostics' },
  { value: 'bugs', label: 'Bug reports', description: 'Capture and review project bugs' },
  { value: 'notes', label: 'Notes', description: 'Project notes and context' },
  { value: 'llm', label: 'LLM context', description: 'Export context for AI-assisted work' },
  { value: 'engine', label: 'Search & indexing', description: 'Index files, search code, and inspect Git insights' },
  { value: 'git', label: 'Git workflow', description: 'Review branch state and changes' },
]

interface ProjectDetailTabsProps {
  overviewPanel: ReactNode
  healthPanel: ReactNode
  notesPanel: ReactNode
  llmPanel?: ReactNode | null
  enginePanel: ReactNode | null
  gitPanel: ReactNode | null
  bugsPanel?: ReactNode
  defaultTab?: TabValue
}

export function ProjectDetailTabs({
  overviewPanel,
  healthPanel,
  notesPanel,
  llmPanel,
  enginePanel,
  gitPanel,
  bugsPanel,
  defaultTab,
}: ProjectDetailTabsProps) {
  const safeDefault: TabValue =
    defaultTab &&
    (defaultTab !== 'llm' || llmPanel != null) &&
    (defaultTab !== 'engine' || enginePanel !== null) &&
    (defaultTab !== 'git' || gitPanel !== null)
      ? defaultTab
      : 'overview'

  return (
    <Tabs defaultValue={safeDefault} className="flex flex-col h-full">
      <div className="shrink-0 px-6 pt-5 pb-2">
        <TabsList>
          {tabItems.map((tab) => {
            const isOptional = tab.value === 'llm' || tab.value === 'engine' || tab.value === 'git'
            const isAvailable = tab.value === 'llm'
              ? llmPanel != null
              : tab.value === 'engine'
                ? enginePanel !== null
                : tab.value === 'git'
                  ? gitPanel !== null
                  : !isOptional

            return isAvailable ? (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                aria-label={`${tab.label}: ${tab.description}`}
                title={tab.description}
              >
                {tab.label}
              </TabsTrigger>
            ) : null
          })}
        </TabsList>
      </div>
      <TabsContent value="overview" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
        {overviewPanel}
      </TabsContent>
      <TabsContent value="health" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
        {healthPanel}
      </TabsContent>
      <TabsContent value="bugs" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
        {bugsPanel ?? <BugsPlaceholder />}
      </TabsContent>
      <TabsContent value="notes" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
        {notesPanel}
      </TabsContent>
      {llmPanel != null && (
        <TabsContent value="llm" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
          {llmPanel}
        </TabsContent>
      )}
      {enginePanel !== null && (
        <TabsContent value="engine" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
          {enginePanel}
        </TabsContent>
      )}
      {gitPanel !== null && (
        <TabsContent value="git" className="flex-1 overflow-auto p-6 pt-5 focus-visible:outline-none">
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
