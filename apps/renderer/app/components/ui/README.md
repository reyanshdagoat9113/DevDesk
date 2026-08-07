# Renderer UI primitives

Use the shared primitives in this directory for new renderer work. Prefer semantic tokens such as `bg-surface`, `bg-surface-muted`, `bg-code`, and `text-status-success`/`text-status-error` over one-off colors.

- `Panel` groups related content. Use its header/content/footer parts when the grouping needs a consistent surface; keep `Card` for existing consumers until they are intentionally migrated.
- `EmptyState` is for an intentionally empty collection or first-use screen and should include a useful explanation and, when available, a primary action.
- `LoadingState` communicates an in-flight view or request and includes an accessible status label.
- `ErrorState` is for a failed view or request. Provide a recovery action or `onRetry` whenever recovery is possible.
- `StatusNotice` is for inline success, warning, error, informational, or inactive feedback. Use `tone="error"` for failures that should announce as an alert.
- `Badge` is a non-interactive `span` for compact metadata. Do not put buttons or links inside it; use `Button` or `IconButton` for actions.
- `IconButton` is for icon-only actions and requires an accessible `aria-label`. Use `ToolbarButton` for compact labeled actions in toolbars.

All primitives are exported from `index.ts` so consumers can use a stable import surface.
