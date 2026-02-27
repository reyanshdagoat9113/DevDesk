# Phase 1.2: Command Variables - Implementation Checklist

Quick reference for implementing Command Variables feature.

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/desktop/commands/variableResolver.ts` | Core variable resolution logic |
| `apps/desktop/commands/variableDetector.ts` | Auto-detect variables from command strings |
| `apps/renderer/app/components/VariablePromptModal.tsx` | UI modal for variable input |

---

## Files to Modify

### Data Layer
- [ ] `apps/desktop/data/model.ts` - Add `CommandVariable` interface, update `Command` interface
- [ ] `apps/desktop/data/store.ts` - Add `variables` column to commands table
- [ ] `apps/renderer/app/types.ts` - Mirror type updates for renderer

### Main Process
- [ ] `apps/desktop/ipc/registerIpc.ts` - Update `commands:run`, add `commands:detect-variables`
- [ ] `apps/desktop/preload.ts` - Expose new APIs to renderer

### Renderer Process  
- [ ] `apps/renderer/app/types/electron.d.ts` - Update `ElectronAPI` interface
- [ ] `apps/renderer/app/sections/CommandsSection.tsx` - Integrate variable prompting
- [ ] `apps/renderer/app/sections/CommandsSection.tsx` - Show detected variables in editor

---

## Implementation Steps

### Step 1: Data Model (15 min)
```typescript
// Add to apps/desktop/data/model.ts
export interface CommandVariable {
  name: string
  default?: string
  required: boolean
  description?: string
}

// Update Command interface
export interface Command {
  // ... existing fields
  variables?: CommandVariable[]
}
```

### Step 2: Database Schema (10 min)
```sql
-- Add to createSchema() in store.ts
variables TEXT  -- JSON array of CommandVariable
```

### Step 3: Variable Resolver (30 min)
- Create `variableResolver.ts` with `VariableResolver` class
- Implement `extractVariables()` method
- Implement `resolve()` method for all variable types
- Add shell escaping for safety

### Step 4: Variable Detection (15 min)
- Create `variableDetector.ts`
- Implement `detectVariables()` function
- Filter out built-in variables (project, container, env)

### Step 5: IPC Updates (20 min)
- Update `commands:run` to accept `variables` parameter
- Add return type for `needs-input` status
- Add `commands:detect-variables` handler

### Step 6: Preload Updates (10 min)
```typescript
runCommand: (id, projectId?, variables?) => ipcRenderer.invoke('commands:run', ...),
detectCommandVariables: (command) => ipcRenderer.invoke('commands:detect-variables', command),
```

### Step 7: Variable Prompt Modal (30 min)
- Create modal with form inputs for each variable
- Show command preview
- Validate required fields
- Handle submit/cancel

### Step 8: CommandsSection Integration (30 min)
- Add state for variable prompting
- Update `handleRun` to check for `needs-input` response
- Add `handleVariableSubmit` to complete execution
- Render `VariablePromptModal` in JSX

### Step 9: Command Editor Enhancement (20 min)
- Detect variables as user types
- Show badges for detected variables
- Add help text

---

## Testing Scenarios

### Basic Functionality
```bash
# Test 1: Project variable
docker build -t {{project.name}} .
# Expected: Resolves to actual project name

# Test 2: Input prompt
git commit -m "{{input:Commit message}}"
# Expected: Prompts user, then runs with entered value

# Test 3: Environment variable
NODE_ENV={{env.NODE_ENV}} npm start
# Expected: Resolves to environment variable value
```

### Edge Cases
```bash
# Test 4: Multiple variables
docker exec -it {{container.name}} {{input:Command to run}}

# Test 5: Variable with spaces in value
echo {{input:Message with spaces}}
# Expected: Properly escaped shell value

# Test 6: Cancelled prompt
# Click Cancel in variable modal
# Expected: Command does not run
```

---

## Code Review Checklist

- [ ] Shell escaping is applied to all resolved values
- [ ] Unknown variables don't crash the app
- [ ] Modal handles empty/invalid input gracefully
- [ ] No memory leaks in modal state management
- [ ] Backward compatibility maintained
- [ ] TypeScript types are complete

---

## Post-Implementation

- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Test in development mode
- [ ] Test with packaged app (`npm run build`)
- [ ] Update user documentation
