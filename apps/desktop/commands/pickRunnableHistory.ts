export type HistoryCommandRef = {
  commandId: string
  projectId?: string
}

export function pickRunnableHistoryEntry<T extends HistoryCommandRef>(
  history: T[],
  options: {
    commandExists: (commandId: string) => boolean
    shouldSkip: (entry: T) => boolean
  },
): T | undefined {
  for (const entry of history) {
    if (!options.commandExists(entry.commandId)) {
      continue
    }
    if (options.shouldSkip(entry)) {
      continue
    }
    return entry
  }
  return undefined
}

export async function runFirstRunnableHistoryCommand<TCommand>(options: {
  history: HistoryCommandRef[]
  getCommand: (commandId: string) => Promise<TCommand | null | undefined>
  runCommand: (command: TCommand, projectId?: string) => Promise<unknown>
  isNeedsInput: (result: unknown) => boolean
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!options.history.length) {
    return { success: false, error: 'No command history found.' }
  }

  const skippedNeedsInputIds = new Set<string>()
  const missingCommandIds = new Set<string>()

  while (true) {
    const candidate = pickRunnableHistoryEntry(options.history, {
      commandExists: (commandId) => !missingCommandIds.has(commandId),
      shouldSkip: (entry) => skippedNeedsInputIds.has(entry.commandId),
    })
    if (!candidate) {
      break
    }

    const command = await options.getCommand(candidate.commandId)
    if (!command) {
      missingCommandIds.add(candidate.commandId)
      continue
    }

    const result = await options.runCommand(command, candidate.projectId)
    if (options.isNeedsInput(result)) {
      skippedNeedsInputIds.add(candidate.commandId)
      continue
    }

    return { success: true }
  }

  if (skippedNeedsInputIds.size > 0 && missingCommandIds.size < options.history.length) {
    return { success: false, error: 'No recent command can run without input variables.' }
  }
  if (missingCommandIds.size > 0) {
    return { success: false, error: 'No recent history command still exists.' }
  }
  return { success: false, error: 'No runnable command found in recent history.' }
}
