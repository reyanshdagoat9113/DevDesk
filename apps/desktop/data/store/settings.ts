import type { AppPreferences } from '../model'
import { createDefaultPreferences } from './shared'
import { ensureDbInitialized, getDbOrThrow, queueWrite } from './core'

export async function getPreferencesFromStore(): Promise<AppPreferences> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare('SELECT key, id, command FROM preferences WHERE key IN (?, ?)')
    .all('editor', 'terminal') as Array<{ key: 'editor' | 'terminal'; id: string; command: string | null }>

  const defaults = createDefaultPreferences()
  const preferenceMap = new Map(rows.map((entry) => [entry.key, entry]))
  return {
    editor: {
      id: preferenceMap.get('editor')?.id ?? defaults.editor.id,
      command: preferenceMap.get('editor')?.command ?? defaults.editor.command,
    },
    terminal: {
      id: preferenceMap.get('terminal')?.id ?? defaults.terminal.id,
      command: preferenceMap.get('terminal')?.command ?? defaults.terminal.command,
    },
  }
}

export async function updatePreferencesInStore(updates: Partial<AppPreferences>): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const current = await getPreferencesFromStore()
    const next = {
      editor: {
        id: updates.editor?.id ?? current.editor.id,
        command: updates.editor?.command ?? current.editor.command,
      },
      terminal: {
        id: updates.terminal?.id ?? current.terminal.id,
        command: updates.terminal?.command ?? current.terminal.command,
      },
    }
    const upsert = database.prepare(
      `
        INSERT INTO preferences (key, id, command)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET id = excluded.id, command = excluded.command
      `
    )
    const transaction = database.transaction(() => {
      upsert.run('editor', next.editor.id, next.editor.command ?? null)
      upsert.run('terminal', next.terminal.id, next.terminal.command ?? null)
    })
    transaction()
  })
}
