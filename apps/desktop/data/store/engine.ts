import type { EngineIndexMeta, EngineIndexProfile, EngineSearchSession } from '../model'
import { parseBoolean } from './shared'
import { ensureDbInitialized, getDbOrThrow, queueWrite } from './core'

const VALID_PROFILES = new Set<EngineIndexProfile>(['source-first', 'source-docs', 'full-text'])

export function normalizeEngineIndexProfile(value: unknown): EngineIndexProfile {
  if (typeof value === 'string' && VALID_PROFILES.has(value as EngineIndexProfile)) {
    return value as EngineIndexProfile
  }
  return 'source-first'
}

export async function listEngineIndexes(): Promise<Record<string, EngineIndexMeta>> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT project_id, db_path, last_indexed, file_count, index_profile
        FROM engine_indexes
        ORDER BY last_indexed DESC, rowid DESC
      `
    )
    .all() as Array<{
    project_id: string
    db_path: string
    last_indexed: string
    file_count: number
    index_profile: string | null
  }>

  return rows.reduce<Record<string, EngineIndexMeta>>((acc, row) => {
    acc[row.project_id] = {
      projectId: row.project_id,
      dbPath: row.db_path,
      lastIndexed: row.last_indexed,
      fileCount: row.file_count,
      indexProfile: normalizeEngineIndexProfile(row.index_profile),
    }
    return acc
  }, {})
}

export async function upsertEngineIndex(entry: EngineIndexMeta): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO engine_indexes (project_id, db_path, last_indexed, file_count, index_profile)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            db_path = excluded.db_path,
            last_indexed = excluded.last_indexed,
            file_count = excluded.file_count,
            index_profile = excluded.index_profile
        `
      )
      .run(
        entry.projectId,
        entry.dbPath,
        entry.lastIndexed,
        entry.fileCount,
        normalizeEngineIndexProfile(entry.indexProfile),
      )
  })
}

export async function clearEngineIndexMeta(projectId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM engine_indexes WHERE project_id = ?').run(projectId)
  })
}

export async function listEngineSearchSessions(): Promise<Record<string, EngineSearchSession>> {
  await ensureDbInitialized()
  const rows = getDbOrThrow()
    .prepare(
      `
        SELECT project_id, query, regex, updated_at, result_json
        FROM engine_search_sessions
        ORDER BY updated_at DESC, rowid DESC
      `
    )
    .all() as Array<{
    project_id: string
    query: string
    regex: number
    updated_at: string
    result_json: string
  }>

  return rows.reduce<Record<string, EngineSearchSession>>((acc, row) => {
    try {
      const result = JSON.parse(row.result_json) as EngineSearchSession['result']
      acc[row.project_id] = {
        projectId: row.project_id,
        query: row.query,
        regex: parseBoolean(row.regex),
        updatedAt: row.updated_at,
        result,
      }
    } catch {
      // Ignore malformed legacy payloads.
    }
    return acc
  }, {})
}

export async function upsertEngineSearchSession(session: EngineSearchSession): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow()
      .prepare(
        `
          INSERT INTO engine_search_sessions (project_id, query, regex, updated_at, result_json)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            query = excluded.query,
            regex = excluded.regex,
            updated_at = excluded.updated_at,
            result_json = excluded.result_json
        `
      )
      .run(
        session.projectId,
        session.query,
        session.regex ? 1 : 0,
        session.updatedAt,
        JSON.stringify(session.result)
      )
  })
}

export async function clearEngineSearchSession(projectId: string): Promise<void> {
  await queueWrite(async () => {
    await ensureDbInitialized()
    getDbOrThrow().prepare('DELETE FROM engine_search_sessions WHERE project_id = ?').run(projectId)
  })
}
