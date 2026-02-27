# Phase 1.2: Command Variables - Implementation Plan

> **Status:** ✅ **COMPLETE**  
> **Priority:** High  
> **Estimated Effort:** 3-4 hours  
> **Dependencies:** None

---

## Overview

Enable dynamic values in commands using template syntax. This allows users to create reusable commands with placeholders that get resolved at runtime.

### Use Cases

1. **Project-aware commands**: `docker build -t {{project.name}} .`
2. **Container integration**: `docker exec -it {{container.name}} bash`
3. **Environment variables**: `NODE_ENV=production API_KEY={{env.API_KEY}} npm start`
4. **Runtime input**: `git commit -m "{{input}}"` - prompts user before execution
5. **Path references**: `cd {{project.path}} && npm run build`

---

## Template Syntax

```
{{project.name}}           → Project name (e.g., "my-app")
{{project.path}}           → Absolute project path
{{project.type}}           → Project type (node/python/rust/go/unknown)
{{container.name}}         → First linked container name
{{container.names}}        → All linked container names (space-separated)
{{env.NAME}}               → Environment variable lookup
{{input}}                  → Prompt user at runtime (required)
{{input:prompt}}           → Prompt with custom label (e.g., {{input:Commit message}})
{{input:default}}          → Optional input with default value
```

### Syntax Rules

- Variables use double curly braces: `{{var}}`
- Whitespace inside braces is optional: `{{ project.name }}` = `{{project.name}}`
- Case-sensitive variable names
- Unknown variables are left as-is with a warning logged
- Special characters in resolved values are properly escaped for shell safety

---

## Data Model Changes

### 1. Extend `Command` Interface

**File:** `apps/desktop/data/model.ts`

```typescript
export interface CommandVariable {
  /** Variable name (e.g., "version", "message") */
  name: string
  /** Default value if not provided */
  default?: string
  /** Whether user must provide this value */
  required: boolean
  /** Description shown in the prompt */
  description?: string
}

export interface Command {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  projectId?: string
  workingDirectory?: string
  /** Detected/defined variables for this command */
  variables?: CommandVariable[]
}
```

### 2. Database Schema Migration

**File:** `apps/desktop/data/store.ts`

Add `variables` column to commands table:

```sql
-- In createSchema function, update commands table:
CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  project_id TEXT,
  working_directory TEXT,
  variables TEXT  -- NEW: JSON array of CommandVariable
);
```

Update database version if using migrations (or auto-detect column).

### 3. Renderer Types Update

**File:** `apps/renderer/app/types.ts`

```typescript
export interface CommandVariable {
  name: string
  default?: string
  required: boolean
  description?: string
}

export interface Command {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  projectId?: string
  workingDirectory?: string
  variables?: CommandVariable[]
}
```

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Renderer Process                         │
│  ┌──────────────────┐    ┌───────────────────────────────────┐  │
│  │ CommandSection   │───→│ VariablePromptModal               │  │
│  │ CommandsSection  │    │ - Shows input fields for vars     │  │
│  │ CommandPalette   │    │ - Remembers last used values      │  │
│  └──────────────────┘    └───────────────────────────────────┘  │
│           │                                                      │
│           ↓ invoke('commands:run', { commandId, projectId,      │
│                                    variables?: Record<string,   │
│                                    string> })                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          Main Process                            │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ VariableResolver                                          │   │
│  │ 1. Parse command for {{variable}} patterns                │   │
│  │ 2. Resolve built-in variables (project, container)        │   │
│  │ 3. Handle env lookups                                     │   │
│  │ 4. Return unresolved {{input}} vars for prompting         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ↓                                      │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ CommandRunner (existing)                                  │   │
│  │ - Execute resolved command                                │   │
│  │ - Store resolved command in run history                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Variable Resolver Service

**File:** `apps/desktop/commands/variableResolver.ts` (NEW)

```typescript
export interface VariableContext {
  project: Project
  containers: Container[]
  env: NodeJS.ProcessEnv
}

export interface VariableResolutionResult {
  /** Command with all possible variables resolved */
  resolvedCommand: string
  /** Variables that require user input */
  unresolvedInputs: Array<{
    name: string
    default?: string
    required: boolean
    description?: string
  }>
  /** Record of resolved values for history */
  resolvedValues: Record<string, string>
}

export class VariableResolver {
  private static readonly VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?(?::[^}]+)?)\s*\}\}/g

  /**
   * Extract all variable names from a command template
   */
  extractVariables(command: string): string[] {
    const variables = new Set<string>()
    const matches = command.matchAll(VariableResolver.VARIABLE_PATTERN)
    for (const match of matches) {
      variables.add(match[1].trim())
    }
    return [...variables]
  }

  /**
   * Resolve variables in a command template
   */
  resolve(command: string, context: VariableContext, userInputs?: Record<string, string>): VariableResolutionResult {
    const resolvedValues: Record<string, string> = {}
    const unresolvedInputs: Array<{ name: string; default?: string; required: boolean; description?: string }> = []

    const resolvedCommand = command.replace(VariableResolver.VARIABLE_PATTERN, (match, varPath: string) => {
      const trimmed = varPath.trim()
      const resolved = this.resolveVariable(trimmed, context, userInputs)
      
      if (resolved.type === 'resolved') {
        resolvedValues[trimmed] = resolved.value
        return resolved.value
      }
      
      if (resolved.type === 'input-required') {
        unresolvedInputs.push({
          name: resolved.name,
          default: resolved.default,
          required: resolved.required,
          description: resolved.description,
        })
      }
      
      // Keep original placeholder if not resolved
      return match
    })

    return { resolvedCommand, unresolvedInputs, resolvedValues }
  }

  private resolveVariable(
    varPath: string, 
    context: VariableContext, 
    userInputs?: Record<string, string>
  ): { type: 'resolved'; value: string } | { type: 'input-required'; name: string; default?: string; required: boolean; description?: string } | { type: 'unresolved' } {
    
    // Handle {{input}} and {{input:prompt}} and {{input:default:value}}
    if (varPath.startsWith('input')) {
      return this.resolveInputVariable(varPath, userInputs)
    }

    // Handle {{env.VAR_NAME}}
    if (varPath.startsWith('env.')) {
      const envName = varPath.slice(4)
      const envValue = context.env[envName]
      if (envValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(envValue) }
      }
      return { type: 'unresolved' }
    }

    // Handle {{project.*}}
    if (varPath.startsWith('project.')) {
      const projectValue = this.resolveProjectVariable(varPath, context.project)
      if (projectValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(projectValue) }
      }
      return { type: 'unresolved' }
    }

    // Handle {{container.*}}
    if (varPath.startsWith('container.')) {
      const containerValue = this.resolveContainerVariable(varPath, context.containers)
      if (containerValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(containerValue) }
      }
      return { type: 'unresolved' }
    }

    return { type: 'unresolved' }
  }

  private resolveInputVariable(
    varPath: string, 
    userInputs?: Record<string, string>
  ): { type: 'resolved'; value: string } | { type: 'input-required'; name: string; default?: string; required: boolean; description?: string } {
    
    // Parse {{input}}, {{input:prompt}}, {{input:default:required}}
    const parts = varPath.split(':')
    
    if (parts.length === 1) {
      // {{input}} - simple prompt
      if (userInputs?.input !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(userInputs.input) }
      }
      return { type: 'input-required', name: 'input', required: true, description: 'Input required' }
    }

    if (parts.length === 2) {
      // {{input:prompt}} or {{input:default}}
      const secondPart = parts[1]
      
      // If it's a known default keyword, treat as optional with default
      if (userInputs?.[secondPart] !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(userInputs[secondPart]) }
      }
      
      // Treat as prompt description
      return { 
        type: 'input-required', 
        name: 'input', 
        required: true, 
        description: secondPart 
      }
    }

    // {{input:name:default}}
    const name = parts[1]
    const defaultValue = parts[2]
    
    if (userInputs?.[name] !== undefined) {
      return { type: 'resolved', value: this.escapeShellValue(userInputs[name]) }
    }
    
    return { 
      type: 'input-required', 
      name, 
      required: false, 
      default: defaultValue,
      description: name 
    }
  }

  private resolveProjectVariable(varPath: string, project: Project): string | undefined {
    const field = varPath.slice(8) // Remove 'project.'
    switch (field) {
      case 'name': return project.name
      case 'path': return project.path
      case 'type': return project.type
      default: return undefined
    }
  }

  private resolveContainerVariable(varPath: string, containers: Container[]): string | undefined {
    const field = varPath.slice(10) // Remove 'container.'
    
    if (field === 'name') {
      return containers[0]?.name
    }
    
    if (field === 'names') {
      return containers.map(c => c.name).join(' ')
    }
    
    return undefined
  }

  /**
   * Escape a value for safe shell usage
   */
  private escapeShellValue(value: string): string {
    // Use single quotes and escape any single quotes in the value
    if (!value.includes("'")) {
      return `'${value}'`
    }
    // Handle values with single quotes by ending quote, adding escaped quote, restarting quote
    return `'${value.replace(/'/g, "'\\''")}'`
  }
}

export const variableResolver = new VariableResolver()
```

### Step 2: Variable Detection in Command Editor

**File:** `apps/desktop/commands/variableDetector.ts` (NEW)

```typescript
import { variableResolver } from './variableResolver'
import type { CommandVariable } from '../data/model'

/**
 * Auto-detect variables from a command string
 */
export function detectVariables(command: string): CommandVariable[] {
  const variables = variableResolver.extractVariables(command)
  const commandVariables: CommandVariable[] = []

  for (const variable of variables) {
    const cmdVar = parseVariableDefinition(variable)
    if (cmdVar && !isBuiltInVariable(variable)) {
      commandVariables.push(cmdVar)
    }
  }

  return commandVariables
}

function isBuiltInVariable(variable: string): boolean {
  // These are auto-resolved, no user input needed
  return (
    variable.startsWith('project.') ||
    variable.startsWith('container.') ||
    variable.startsWith('env.')
  )
}

function parseVariableDefinition(variable: string): CommandVariable | null {
  // Handle {{input}} style variables
  if (variable.startsWith('input')) {
    const parts = variable.split(':')
    
    if (parts.length === 1) {
      return { name: 'input', required: true }
    }
    
    if (parts.length === 2) {
      return { name: parts[1], required: true, description: parts[1] }
    }
    
    return {
      name: parts[1],
      default: parts[2],
      required: false,
      description: parts[1],
    }
  }

  return null
}
```

### Step 3: Update Command Execution Flow

**File:** `apps/desktop/ipc/registerIpc.ts`

Modify the `'commands:run'` handler to:

1. Accept optional `variables` parameter
2. Use `VariableResolver` to resolve command
3. If unresolved inputs exist, return them to renderer for prompting
4. Store resolved command in run history

```typescript
// Add imports at top
import { variableResolver } from '../commands/variableResolver'
import { detectVariables } from '../commands/variableDetector'

// Update the commands:run handler
ipcMain.handle('commands:run', async (_event, _id: string, _projectId?: string, _variables?: Record<string, string>) => {
  const command = await getCommandById(_id)
  if (!command) {
    throw new Error('Command not found.')
  }

  const effectiveProjectId = _projectId ?? command.projectId
  if (!effectiveProjectId) {
    throw new Error('Project is required to run a command.')
  }

  const project = await getProjectById(effectiveProjectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  // Get containers for container variable resolution
  const containers = await listDockerContainers()
  const linkedContainers = containers.filter(c => 
    project.linkedContainerNames.some(name => 
      c.name.toLowerCase() === name.toLowerCase()
    )
  )

  // Resolve variables
  const context = {
    project,
    containers: linkedContainers,
    env: process.env,
  }
  
  const resolution = variableResolver.resolve(command.command, context, _variables)

  // If there are unresolved input variables, return them for prompting
  if (resolution.unresolvedInputs.length > 0 && !_variables) {
    return {
      status: 'needs-input',
      inputs: resolution.unresolvedInputs,
      preview: resolution.resolvedCommand,
    }
  }

  // Continue with execution using resolved command
  const finalCommand = resolution.resolvedCommand
  
  // ... rest of execution logic, storing finalCommand in history
})
```

### Step 4: Add Variable Detection IPC

**File:** `apps/desktop/ipc/registerIpc.ts`

```typescript
ipcMain.handle('commands:detect-variables', async (_event, commandString: string) => {
  return detectVariables(commandString)
})
```

### Step 5: Preload API Updates

**File:** `apps/desktop/preload.ts`

```typescript
// Add to contextBridge.exposeInMainWorld
runCommand: (id: string, projectId?: string, variables?: Record<string, string>) => 
  ipcRenderer.invoke('commands:run', id, projectId, variables),
detectCommandVariables: (command: string) =>
  ipcRenderer.invoke('commands:detect-variables', command),
```

**File:** `apps/renderer/app/types/electron.d.ts`

```typescript
runCommand: (id: string, projectId?: string, variables?: Record<string, string>) => 
  Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: Array<{ name: string; default?: string; required: boolean; description?: string }>; preview: string }>
detectCommandVariables: (command: string) => Promise<CommandVariable[]>
```

### Step 6: Variable Prompt Modal Component

**File:** `apps/renderer/app/components/VariablePromptModal.tsx` (NEW)

```typescript
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import type { CommandVariable } from '../types'

interface VariablePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variables: CommandVariable[]
  commandPreview?: string
  onSubmit: (values: Record<string, string>) => void
  onCancel?: () => void
}

export function VariablePromptModal({
  open,
  onOpenChange,
  variables,
  commandPreview,
  onSubmit,
  onCancel,
}: VariablePromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset values when variables change
  useEffect(() => {
    const initialValues: Record<string, string> = {}
    for (const variable of variables) {
      initialValues[variable.name] = variable.default ?? ''
    }
    setValues(initialValues)
    setErrors({})
  }, [variables])

  const handleSubmit = () => {
    // Validate required fields
    const newErrors: Record<string, string> = {}
    for (const variable of variables) {
      if (variable.required && !values[variable.name]?.trim()) {
        newErrors[variable.name] = 'This field is required'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit(values)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Command Variables</DialogTitle>
          <DialogDescription>
            Enter values for the command variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {commandPreview && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
              <code className="text-xs font-mono break-all">{commandPreview}</code>
            </div>
          )}

          {variables.map((variable) => (
            <div key={variable.name} className="space-y-2">
              <Label htmlFor={`var-${variable.name}`}>
                {variable.description || variable.name}
                {variable.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                id={`var-${variable.name}`}
                value={values[variable.name] ?? ''}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, [variable.name]: e.target.value }))
                  if (errors[variable.name]) {
                    setErrors((prev) => ({ ...prev, [variable.name]: '' }))
                  }
                }}
                placeholder={variable.default}
              />
              {errors[variable.name] && (
                <p className="text-xs text-destructive">{errors[variable.name]}</p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Run Command</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 7: Update CommandsSection

**File:** `apps/renderer/app/sections/CommandsSection.tsx`

Add state and handlers for variable prompting:

```typescript
// Add new state
const [variablePromptOpen, setVariablePromptOpen] = useState(false)
const [pendingVariables, setPendingVariables] = useState<CommandVariable[]>([])
const [commandPreview, setCommandPreview] = useState<string>('')
const [pendingRun, setPendingRun] = useState<{ commandId: string; projectId: string } | null>(null)

// Update handleRun
const handleRun = async () => {
  if (!selectedCommand || !selectedProject || !onRunCommand || runStatus === 'running') {
    if (!selectedProject) {
      setRunError('Select a project to run this command.')
    }
    return
  }
  
  setRunError(null)
  setRunStatus('running')
  
  try {
    // Try to run - may return needs-input status
    const result = await window.electronAPI.runCommand(selectedCommand.id, selectedProject.id)
    
    if (result.status === 'needs-input') {
      // Show variable prompt
      setPendingVariables(result.inputs)
      setCommandPreview(result.preview)
      setPendingRun({ commandId: selectedCommand.id, projectId: selectedProject.id })
      setVariablePromptOpen(true)
      setRunStatus('idle')
      return
    }
    
    // Normal execution
    setRunStatus('started')
    setTimeout(() => setRunStatus('idle'), 1500)
  } catch (error) {
    setRunError(error instanceof Error ? error.message : 'Failed to run command.')
    setRunStatus('idle')
  }
}

// Add handler for variable submission
const handleVariableSubmit = async (values: Record<string, string>) => {
  if (!pendingRun || !onRunCommand) return
  
  setRunStatus('running')
  try {
    await window.electronAPI.runCommand(
      pendingRun.commandId, 
      pendingRun.projectId,
      values
    )
    setRunStatus('started')
    setTimeout(() => setRunStatus('idle'), 1500)
  } catch (error) {
    setRunError(error instanceof Error ? error.message : 'Failed to run command.')
    setRunStatus('idle')
  } finally {
    setPendingRun(null)
    setPendingVariables([])
  }
}

// Add modal to JSX
<VariablePromptModal
  open={variablePromptOpen}
  onOpenChange={setVariablePromptOpen}
  variables={pendingVariables}
  commandPreview={commandPreview}
  onSubmit={handleVariableSubmit}
  onCancel={() => {
    setPendingRun(null)
    setPendingVariables([])
  }}
/>
```

### Step 8: Show Variables in Command Editor

**File:** `apps/renderer/app/sections/CommandsSection.tsx`

Add a section in the edit dialog to show detected variables:

```typescript
// Add state for detected variables
const [detectedVariables, setDetectedVariables] = useState<CommandVariable[]>([])

// Detect variables when command changes
useEffect(() => {
  const detect = async () => {
    if (!editCommand.trim()) {
      setDetectedVariables([])
      return
    }
    try {
      const vars = await window.electronAPI.detectCommandVariables(editCommand)
      setDetectedVariables(vars)
    } catch {
      setDetectedVariables([])
    }
  }
  detect()
}, [editCommand])

// Add to edit dialog JSX
{detectedVariables.length > 0 && (
  <div className="space-y-2">
    <Label>Detected Variables</Label>
    <div className="flex flex-wrap gap-2">
      {detectedVariables.map((variable) => (
        <Badge key={variable.name} variant="secondary" className="text-xs">
          {variable.name}
          {variable.required && <span className="text-destructive ml-1">*</span>}
        </Badge>
      ))}
    </div>
    <p className="text-xs text-muted-foreground">
      Users will be prompted to enter values when running this command.
    </p>
  </div>
)}
```

### Step 9: Update Run History Display

**File:** `apps/renderer/app/sections/HistorySection.tsx`

Show resolved command in history:

```typescript
// In the detail view, show the actual command that was executed
// This requires storing the resolved command in run history
```

**File:** `apps/desktop/data/model.ts`

Add resolved command to run history:

```typescript
export interface RunHistoryEntry {
  id: string
  commandId: string
  projectId?: string
  status: RunStatus
  startTime: string
  endTime?: string
  output?: string
  resolvedCommand?: string  // NEW: The actual command executed
}
```

---

## Testing Checklist

### Unit Tests (Future)

- [ ] VariableResolver.extractVariables() correctly parses all syntax variations
- [ ] VariableResolver.resolve() handles all built-in variables
- [ ] Shell escaping is correct for various input types
- [ ] detectVariables() correctly identifies input variables

### Integration Tests

- [ ] `{{project.name}}` resolves to correct project name
- [ ] `{{project.path}}` resolves to correct absolute path
- [ ] `{{project.type}}` shows correct type
- [ ] `{{container.name}}` resolves first linked container
- [ ] `{{env.HOME}}` resolves environment variable
- [ ] `{{input}}` prompts user before execution
- [ ] `{{input:Commit message}}` shows custom prompt
- [ ] `{{input:version:1.0.0}}` shows optional with default
- [ ] Variables work in Command Palette
- [ ] Resolved command is stored in run history
- [ ] Special characters in variable values are escaped properly

### Edge Cases

- [ ] Unknown variables are left as-is with warning
- [ ] Empty project (no linked containers) - container vars return empty
- [ ] Missing env variable - left as-is or empty string
- [ ] Very long variable values
- [ ] Variables containing shell special characters
- [ ] Cancelled variable prompt doesn't run command
- [ ] Multiple `{{input}}` variables in single command

---

## UI/UX Considerations

### Variable Prompt Modal

- Show preview of resolved command with placeholders
- Required fields marked with red asterisk
- Remember last used values per command (localStorage)
- Support Enter key to submit
- Escape key to cancel

### Command Editor

- Live detection of variables as user types
- Visual indicator showing detected variables
- Help tooltip explaining variable syntax
- Link to documentation

### History Display

- Show resolved command that was actually executed
- Option to view original template
- Copy resolved command to clipboard

---

## Migration & Backward Compatibility

- Existing commands without variables work unchanged
- Database migration adds nullable `variables` column
- Commands with `{{}}` syntax but no stored variables are auto-detected at runtime

---

## Future Enhancements (Out of Scope)

- **Variable Types**: Number, boolean, enum, file path picker
- **Conditional Variables**: `{{if:condition}}value{{/if}}`
- **Variable Validation**: Regex patterns for input validation
- **Secret Variables**: Masked input for passwords/tokens
- **Variable History**: Remember recent values across commands
- **Nested Variables**: `{{env.{{input:ENV_NAME}}}}`

---

## Implementation Order

1. ✅ **Data Model** - Update interfaces and database schema
2. ✅ **Variable Resolver** - Core resolution logic (`apps/desktop/commands/variableResolver.ts`)
3. ✅ **Variable Detection** - Auto-detect from command strings (`apps/desktop/commands/variableDetector.ts`)
4. ✅ **IPC Integration** - Update run handler and add detection endpoint
5. ✅ **Preload Bridge** - Expose to renderer
6. ✅ **Prompt Modal** - UI for variable input (`apps/renderer/app/components/VariablePromptModal.tsx`)
7. ✅ **CommandSection Updates** - Integrate prompting with variable detection display
8. ✅ **CommandPalette Updates** - Variable prompting support in global palette
9. ✅ **History Updates** - Store and display resolved commands
10. ✅ **Type Check & Build** - All passing

---

## Acceptance Criteria

- [x] Commands with `{{project.name}}` resolve correctly
- [x] User is prompted for `{{input}}` variables
- [x] Variable values appear resolved in run history
- [x] Works with existing command palette (including variable prompting)
- [x] Shell injection is prevented via proper escaping
- [x] Unknown variables don't crash the app
- [x] Backward compatible with existing commands
- [x] Variable detection shows in command editor
- [x] Variables display as badges in command list and detail views
