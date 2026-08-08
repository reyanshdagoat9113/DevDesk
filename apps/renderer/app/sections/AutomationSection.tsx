import { useState } from 'react'

import { Plus } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { CommandsSection } from './CommandsSection'
import { CommandChainsPanel } from './CommandChainsPanel'
import { CommandTriggersPanel } from './CommandTriggersPanel'
import type {
  Command,
  CommandChain,
  CommandChainRunState,
  CommandTrigger,
  CreateCommandChainInput,
  CreateCommandTriggerInput,
  CreateCommandInput,
  Project,
} from '../types'

type AutomationSectionProps = {
  commands: Command[]
  chains: CommandChain[]
  triggers: CommandTrigger[]
  projects: Project[]
  chainRuns: Record<string, CommandChainRunState>
  isLoading?: boolean
  error?: string | null
  onRunCommand?: (commandId: string, projectId: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: { name: string; default?: string; required: boolean; description?: string }[]; preview: string }>
  onUpdateCommand?: (commandId: string, updates: { name: string; command: string; description?: string; tags?: string[] }) => Promise<void>
  onRemoveCommand?: (commandId: string) => Promise<void>
  onToggleCommandPin?: (commandId: string) => Promise<void>
  onCreatePresetCommand?: (command: CreateCommandInput) => Promise<Command>
  onCreateChain: (input: CreateCommandChainInput) => Promise<CommandChain>
  onUpdateChain: (chainId: string, input: CreateCommandChainInput) => Promise<CommandChain>
  onRemoveChain: (chainId: string) => Promise<void>
  onRunChain: (chainId: string, projectId?: string) => Promise<{ runId: string; status: string }>
  onCreateTrigger: (input: CreateCommandTriggerInput) => Promise<CommandTrigger>
  onUpdateTrigger: (triggerId: string, input: CreateCommandTriggerInput) => Promise<CommandTrigger>
  onRemoveTrigger: (triggerId: string) => Promise<void>
  onOpenCreateCommand?: () => void
  onOpenHistory?: (runId?: string) => void
}

export function AutomationSection(props: AutomationSectionProps) {
  const [activeView, setActiveView] = useState<'commands' | 'chains' | 'triggers'>('commands')
  const [seedCommand, setSeedCommand] = useState<Command | null>(null)

  return (
    <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'commands' | 'chains' | 'triggers')} className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-4 px-8 pt-5 pb-3 lg:px-12">
        <TabsList className="gap-1 bg-muted/30 p-1">
          <TabsTrigger value="commands" className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold">
            Commands
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">({props.commands.length})</span>
          </TabsTrigger>
          <TabsTrigger value="chains" className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold">
            Chains
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">({props.chains.length})</span>
          </TabsTrigger>
          <TabsTrigger value="triggers" className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold">
            Triggers
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">({props.triggers.length})</span>
          </TabsTrigger>
        </TabsList>
        {activeView === 'commands' ? (
          <Button size="sm" className="gap-1.5 h-8" onClick={props.onOpenCreateCommand}>
            <Plus className="h-3.5 w-3.5" />
            New Command
          </Button>
        ) : null}
      </div>

      <TabsContent value="commands" className="mt-0 flex-1 min-h-0">
        <CommandsSection
          commands={props.commands}
          projects={props.projects}
          isLoading={props.isLoading}
          error={props.error}
          onRunCommand={props.onRunCommand}
          onUpdateCommand={props.onUpdateCommand}
          onRemoveCommand={props.onRemoveCommand}
          onToggleCommandPin={props.onToggleCommandPin}
          onCreatePresetCommand={props.onCreatePresetCommand}
          onOpenHistory={props.onOpenHistory}
          onOpenCreateCommand={props.onOpenCreateCommand}
          onAddToChain={(command) => {
            setSeedCommand(command)
            setActiveView('chains')
          }}
        />
      </TabsContent>

      <TabsContent value="chains" className="mt-0 flex-1 min-h-0">
        <CommandChainsPanel
          chains={props.chains}
          commands={props.commands}
          projects={props.projects}
          chainRuns={props.chainRuns}
          isLoading={props.isLoading}
          error={props.error}
          seedCommand={seedCommand}
          onSeedCommandHandled={() => setSeedCommand(null)}
          onCreateChain={props.onCreateChain}
          onUpdateChain={props.onUpdateChain}
          onRemoveChain={props.onRemoveChain}
          onRunChain={props.onRunChain}
        />
      </TabsContent>

      <TabsContent value="triggers" className="mt-0 flex-1 min-h-0">
        <CommandTriggersPanel
          triggers={props.triggers}
          chains={props.chains}
          projects={props.projects}
          isLoading={props.isLoading}
          error={props.error}
          onCreateTrigger={props.onCreateTrigger}
          onUpdateTrigger={props.onUpdateTrigger}
          onRemoveTrigger={props.onRemoveTrigger}
        />
      </TabsContent>
    </Tabs>
  )
}
