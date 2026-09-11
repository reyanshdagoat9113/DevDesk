import type { Command } from '../data/model'

export type CommandUpdates = {
  name?: string
  command?: string
  description?: string | null
  tags?: unknown
  projectId?: string | null
  workingDirectory?: string | null
}

function applyClearableString(
  value: string | null | undefined,
  current: string | undefined
): string | undefined {
  if (value === undefined) {
    return current
  }
  if (value === null) {
    return undefined
  }
  if (typeof value !== 'string') {
    return current
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * Merge command updates onto the current record.
 * Omitted / undefined fields are kept; explicit null clears optional fields.
 */
export function applyCommandUpdates(current: Command, updates?: CommandUpdates | null): Command {
  const nextName = typeof updates?.name === 'string' ? updates.name.trim() : undefined
  const nextCommand = typeof updates?.command === 'string' ? updates.command.trim() : undefined
  if (nextName !== undefined && !nextName) {
    throw new Error('Command name is required.')
  }
  if (nextCommand !== undefined && !nextCommand) {
    throw new Error('Command is required.')
  }

  const tags = Array.isArray(updates?.tags)
    ? updates.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : current.tags

  return {
    ...current,
    name: nextName ?? current.name,
    command: nextCommand ?? current.command,
    description: applyClearableString(updates?.description, current.description),
    tags,
    projectId: applyClearableString(updates?.projectId, current.projectId),
    workingDirectory: applyClearableString(updates?.workingDirectory, current.workingDirectory),
  }
}
