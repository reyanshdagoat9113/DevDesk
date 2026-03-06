import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { CommandsSection } from './CommandsSection'
import { CommandChainsPanel } from './CommandChainsPanel'
import type {
  Command,
  CommandChain,
  CommandChainRunState,
  CreateCommandChainInput,
  CreateCommandInput,
  Project,
} from '../types'

type AutomationSectionProps = {
  commands: Command[]
  chains: CommandChain[]
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
}

export function AutomationSection(props: AutomationSectionProps) {
  const [activeView, setActiveView] = useState<'commands' | 'chains'>('commands')
  const [seedCommand, setSeedCommand] = useState<Command | null>(null)

  return (
    <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'commands' | 'chains')} className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="commands">Commands ({props.commands.length})</TabsTrigger>
          <TabsTrigger value="chains">Chains ({props.chains.length})</TabsTrigger>
        </TabsList>
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
    </Tabs>
  )
}
