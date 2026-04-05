import type { CommandChain, CommandTrigger, CommandTriggerEvent } from '../model'
import { parseChainSteps } from './normalize'
import { parseBoolean } from './shared'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'

export async function createChain(chain: CommandChain): Promise<void> {
  await queueWrite(async () => withSqlTiming('createChain', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO chains (id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        chain.id,
        chain.name,
        chain.description ?? null,
        chain.projectId ?? null,
        JSON.stringify(chain.steps ?? []),
        chain.stopOnFailure ? 1 : 0,
        chain.parallel ? 1 : 0,
        chain.createdAt,
        chain.updatedAt
      )
  }))
}

export async function replaceChain(chain: CommandChain): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE chains
          SET name = ?, description = ?, project_id = ?, steps = ?, stop_on_failure = ?, parallel = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        chain.name,
        chain.description ?? null,
        chain.projectId ?? null,
        JSON.stringify(chain.steps ?? []),
        chain.stopOnFailure ? 1 : 0,
        chain.parallel ? 1 : 0,
        chain.updatedAt,
        chain.id
      )
    return result.changes > 0
  })
}

export async function removeChain(chainId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()
    const transaction = database.transaction((id: string) => {
      database.prepare('DELETE FROM triggers WHERE chain_id = ?').run(id)
      database.prepare('DELETE FROM chains WHERE id = ?').run(id)
    })
    transaction(chainId)
  })
}

export async function createTrigger(trigger: CommandTrigger): Promise<void> {
  await queueWrite(async () => withSqlTiming('createTrigger', async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO triggers (id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        trigger.id,
        trigger.name,
        trigger.description ?? null,
        trigger.projectId ?? null,
        trigger.chainId,
        trigger.event,
        trigger.enabled ? 1 : 0,
        trigger.requireConfirmation ? 1 : 0,
        trigger.createdAt,
        trigger.updatedAt
      )
  }))
}

export async function replaceTrigger(trigger: CommandTrigger): Promise<boolean> {
  return queueWrite(async () => {
    await ensureDbInitialized()
    const result = getDbOrThrow()
      .prepare(
        `
          UPDATE triggers
          SET name = ?, description = ?, project_id = ?, chain_id = ?, event_type = ?, enabled = ?, require_confirmation = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        trigger.name,
        trigger.description ?? null,
        trigger.projectId ?? null,
        trigger.chainId,
        trigger.event,
        trigger.enabled ? 1 : 0,
        trigger.requireConfirmation ? 1 : 0,
        trigger.updatedAt,
        trigger.id
      )
    return result.changes > 0
  })
}

export async function removeTrigger(triggerId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM triggers WHERE id = ?').run(triggerId)
  })
}

export async function listChains(): Promise<CommandChain[]> {
  return withSqlTiming('listChains', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare(
        `
          SELECT id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at
          FROM chains
          ORDER BY rowid ASC
        `
      )
      .all() as Array<{
      id: string
      name: string
      description: string | null
      project_id: string | null
      steps: string
      stop_on_failure: number
      parallel: number
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      projectId: row.project_id ?? undefined,
      steps: parseChainSteps(row.steps),
      stopOnFailure: parseBoolean(row.stop_on_failure),
      parallel: parseBoolean(row.parallel),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  })
}

export async function getChainById(chainId: string): Promise<CommandChain | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare(
      `
        SELECT id, name, description, project_id, steps, stop_on_failure, parallel, created_at, updated_at
        FROM chains
        WHERE id = ?
      `
    )
    .get(chainId) as {
    id: string
    name: string
    description: string | null
    project_id: string | null
    steps: string
    stop_on_failure: number
    parallel: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    projectId: row.project_id ?? undefined,
    steps: parseChainSteps(row.steps),
    stopOnFailure: parseBoolean(row.stop_on_failure),
    parallel: parseBoolean(row.parallel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listTriggers(): Promise<CommandTrigger[]> {
  return withSqlTiming('listTriggers', async () => {
    await ensureDbInitialized()
    const rows = getDbOrThrow()
      .prepare(
        `
          SELECT id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at
          FROM triggers
          ORDER BY rowid ASC
        `
      )
      .all() as Array<{
      id: string
      name: string
      description: string | null
      project_id: string | null
      chain_id: string
      event_type: CommandTriggerEvent
      enabled: number
      require_confirmation: number
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      projectId: row.project_id ?? undefined,
      chainId: row.chain_id,
      event: row.event_type,
      enabled: parseBoolean(row.enabled),
      requireConfirmation: parseBoolean(row.require_confirmation),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  })
}

export async function getTriggerById(triggerId: string): Promise<CommandTrigger | null> {
  await ensureDbInitialized()
  const row = getDbOrThrow()
    .prepare(
      `
        SELECT id, name, description, project_id, chain_id, event_type, enabled, require_confirmation, created_at, updated_at
        FROM triggers
        WHERE id = ?
      `
    )
    .get(triggerId) as {
    id: string
    name: string
    description: string | null
    project_id: string | null
    chain_id: string
    event_type: CommandTriggerEvent
    enabled: number
    require_confirmation: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    projectId: row.project_id ?? undefined,
    chainId: row.chain_id,
    event: row.event_type,
    enabled: parseBoolean(row.enabled),
    requireConfirmation: parseBoolean(row.require_confirmation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
