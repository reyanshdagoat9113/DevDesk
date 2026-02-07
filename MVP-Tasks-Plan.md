# Plan: MVP Tasks (Commands Filter + History Names)

This plan covers:

- Task 1: Command search/filter by tag
- Task 2: Run history shows command + project names (not just ids)

Scope note: this is renderer-only work (UI + client-side joins/filters) and does not require any main-process or persistence changes.

---

## Goal and Constraints

Goals

- Make it fast to find a saved command by tag (and optionally by text).
- Make run history readable at a glance by showing human names.
- Keep behavior predictable and safe (no implicit command execution changes).

Constraints

- Use existing shadcn/ui wrappers in `apps/renderer/app/components/ui` (Radix primitives under the hood).
- Avoid changing preload IPC or main-process APIs unless truly necessary.
- Handle missing/deleted references gracefully.

Shadcn/Radix requirement (explicit)

- Any new interactive UI must use shadcn/ui components (and their Radix accessibility behavior) rather than custom div-based controls.
- Prefer existing components first (`Button`, `Input`, `Badge`, `ScrollArea`, `Dialog`, `Select`, `Tabs`, etc.).
- If we truly need a missing primitive (e.g. Popover / ToggleGroup), add it via shadcn/ui in `apps/renderer/app/components/ui/*` using the standard Radix-backed implementation and `cn` utility.
- Maintain accessibility defaults: keyboard navigation, focus-visible rings, and ARIA states (e.g. `aria-pressed` for toggle-like tag filters).

---

## Task 1: Command Search/Filter by Tag

### What “Done” Looks Like

- A user can narrow the command list by selecting a tag.
- Clearing the filter returns the full list.
- Filtering works for both project-bound and global commands.
- If a command has no tags, it never appears when a tag filter is active.

Optional (nice-to-have, but keep minimal):

- A text search input that matches command name/description/command text/tags.

### UX Proposal (Minimal, High-Value)

Add a small filter bar at the top of the Commands list panel in `apps/renderer/app/sections/CommandsSection.tsx` using shadcn/ui building blocks:

- Tag chips (click to filter): render as real `Button`s (or a shadcn ToggleGroup if added) so they are keyboard-accessible.
- “All” / “Clear” control: a `Button` (likely `ghost` or `outline`) to reset state.
- Optional: a compact search `Input` with placeholder “Search commands…”.

Behavior details

- Tag selection is single-select by default (simplest mental model).
- If search input exists, it composes with tag filtering (AND):
  - tag filter reduces set
  - search reduces further

### Data Model Assumptions

- `Command.tags` is `string[] | undefined`.
- Tags are currently user-entered and stored as typed (case sensitivity may vary).

Recommendation

- Normalize tag matching to case-insensitive.
- Display tags as originally stored, but match with `toLowerCase()`.

### Implementation Plan (Renderer)

1) Collect available tags

- Derive a tag list from `commands` via `useMemo`.
- Build a frequency map to order tags by usage, then alphabetically as tie-breaker.
- Keep original casing for display, but store a normalized key for matching.

2) Add filter state

- `selectedTag: string | null` (store normalized key).
- Optional: `query: string`.
- Keep these states local to `CommandsSection`.

3) Compute filtered commands

- Create `filteredCommands` via `useMemo`.
- Apply filters:
  - If `selectedTag` exists, require `command.tags` includes that tag (case-insensitive).
  - If `query` exists, match against:
    - `command.name`
    - `command.description ?? ''`
    - `command.command`
    - `command.tags ?? []`
  - Use simple substring match on a normalized string (lowercase + trim).

4) Wire list rendering to filtered list

- Replace `commands.map(...)` with `filteredCommands.map(...)`.
- Ensure `selectedId` stays valid when filters change:
  - If the currently selected command is filtered out, select the first item in `filteredCommands`.
  - If `filteredCommands` is empty, set `selectedId` to null.

5) Empty states

- If `commands.length === 0`: keep existing “No commands saved yet.”
- Else if `filteredCommands.length === 0`: show “No commands match your filter.”

6) Interaction polish

- Clicking an active tag chip toggles it off.
- Show count of matches (optional): “12 commands” / “3 matches”.

### Components to Use

- `Button` for tag chips (toggle state via `aria-pressed` and clear visual selected styling).
- `Badge` for passive metadata (e.g. tag count), not as the primary interactive control unless wrapped in a `Button`.
- `Input` for search (optional).
- `Button` for “Clear”.
- Optional: `ScrollArea` if tag chips need horizontal scroll.

### Edge Cases

- Tags with extra spaces: matching should trim.
- Duplicate tags in a single command: de-dupe during tag extraction.
- Very long tag lists: consider horizontal scroll or a “More” truncation later; for MVP, allow wrap.

### Acceptance Checklist (Manual)

- Add two commands with tags `test` and `build`.
- Filter by `test` shows only `test` commands.
- Toggle tag off returns full list.
- Case-insensitive match works (`Test` matches `test`).
- Filtering never breaks the detail panel selection.

---

## Task 2: Run History Shows Command + Project Names

### What “Done” Looks Like

- History list rows show:
  - command name (primary)
  - project name (secondary)
  - timestamp and status remain visible
- History detail header shows command name and project name.
- If command/project no longer exists, show a clear fallback label.

### UX Proposal

In `apps/renderer/app/sections/HistorySection.tsx`, update the two places that currently render:

- “Command #<id>” in list rows
- “Command #<id>” in detail header and dialog description

Replace with something like:

- Primary: command name (or “Unknown command”)
- Secondary: project name (or “Unknown project”)

Keep ids out of the main UI, but optionally show them in muted text for debugging (not required for MVP).

### Data Requirements

`HistorySection` currently receives only `history: RunHistoryEntry[]`.

Plan: pass `commands` and `projects` down from `apps/renderer/app/App.tsx` so HistorySection can resolve names.

- Update `HistorySection` props to include:
  - `commands: Command[]`
  - `projects: Project[]`

This keeps the join logic in the renderer and avoids IPC changes.

### Implementation Plan (Renderer)

1) Update component props

- Modify `HistorySection` signature to accept `commands` and `projects`.
- Update the call site in `apps/renderer/app/App.tsx` to pass existing state arrays.

2) Create lookup maps

- In `HistorySection`, build:
  - `commandById: Record<string, Command>` via `useMemo`
  - `projectById: Record<string, Project>` via `useMemo`

3) Resolve display strings per entry

For each history entry:

- `commandName = commandById[entry.commandId]?.name ?? 'Unknown command'`
- `projectName = projectById[entry.projectId]?.name ?? 'Unknown project'`

Recommended nuance:

- If a project was deleted, but history remained, “Removed project” might be better than “Unknown project”.
- If a command was deleted, “Removed command” might be better than “Unknown command”.

4) Update UI strings

- List row title: `commandName`.
- List row subtitle: `projectName` + existing timestamp (or timestamp stays as currently, and project becomes an extra line).
- Detail header: show both names.
- Dialog description: “Full output for <commandName>” (and optionally “(<projectName>)”).

5) Keep behavior unchanged

- Selection logic (selectedId) stays based on run id.
- Output loading/stopping remains untouched.

### Edge Cases

- History loaded before commands/projects: lookups should tolerate empty arrays and show fallback names.
- Commands/projects updated after history load: UI should re-render automatically via props.
- IDs collision is not expected; use simple maps.

### Acceptance Checklist (Manual)

- Run a command bound to a project; history row shows command name and project name.
- Delete the command; history row should show fallback for command, still show project name.
- Delete the project; history row should show fallback for project, still show command fallback/name.
- History detail view and “View Full Output” dialog reflect names.

---

## Suggested Delivery Order

1) Task 3 first (history naming)

- Small surface area, low risk, immediate usability improvement.

2) Task 2 next (commands filter)

- More UI/selection interactions; easier to evaluate after the app still “feels stable”.

---

## Files Expected to Change (When Implementing)

- `apps/renderer/app/sections/CommandsSection.tsx`
- `apps/renderer/app/sections/HistorySection.tsx`
- `apps/renderer/app/App.tsx`

---

## Quality Gates

- `npm run lint`
- `npm run typecheck`
- Manual smoke test:
  - add/edit commands, apply filter
  - run a command, verify history renders names, open output
