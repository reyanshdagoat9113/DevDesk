import { useMemo, useState } from 'react'
import { Container, FolderKanban, History, Plus, StickyNote, Terminal } from 'lucide-react'
import { Button } from './components/ui/Button'
import { AppShell } from './layout/AppShell'
import { CommandsSection } from './sections/CommandsSection'
import { ContainersSection } from './sections/ContainersSection'
import { HistorySection } from './sections/HistorySection'
import { NotesSection } from './sections/NotesSection'
import { ProjectsSection } from './sections/ProjectsSection'
import { mockCommands, mockContainers, mockNotes, mockProjects, mockRunHistory } from './lib/mockData'

type TabValue = 'projects' | 'commands' | 'containers' | 'history' | 'notes'

const navItems = [
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'commands', label: 'Commands', icon: Terminal },
  { value: 'containers', label: 'Containers', icon: Container },
  { value: 'history', label: 'History', icon: History },
  { value: 'notes', label: 'Notes', icon: StickyNote },
] as const

const actionLabels: Partial<Record<TabValue, string>> = {
  projects: 'Add Project',
  commands: 'New Command',
}

function App() {
  const [activeTab, setActiveTab] = useState<TabValue>('projects')

  const title = useMemo(() => navItems.find((item) => item.value === activeTab)?.label ?? '', [activeTab])
  const actionLabel = actionLabels[activeTab]

  return (
    <AppShell
      navItems={navItems}
      activeNav={activeTab}
      onNavChange={(value) => setActiveTab(value as TabValue)}
      title={title}
      action={
        actionLabel ? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null
      }
    >
      <div className="h-full">
        {activeTab === 'projects' && <ProjectsSection projects={mockProjects} />}
        {activeTab === 'commands' && <CommandsSection commands={mockCommands} />}
        {activeTab === 'containers' && <ContainersSection containers={mockContainers} />}
        {activeTab === 'history' && <HistorySection history={mockRunHistory} />}
        {activeTab === 'notes' && <NotesSection projects={mockProjects} notes={mockNotes} />}
      </div>
    </AppShell>
  )
}

export default App
