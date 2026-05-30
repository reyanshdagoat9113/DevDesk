import fs from 'node:fs/promises'

import type Database from 'better-sqlite3'

import { DATA_VERSION } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'
import { getDbPath } from './shared'

export const EXPORT_VERSION = DATA_VERSION

export type ImportMode = 'replace' | 'merge'

export interface ExportHeader {
  version: number
  exportedAt: string
  platform: string
}

export interface ExportData {
  version: number
  exportedAt: string
  platform: string
  tables: Record<string, unknown[][]>
}

export interface ExportResult {
  success: boolean
  data: ExportData
  recordCounts: Record<string, number>
}

export interface ImportResult {
  success: boolean
  recordCounts: Record<string, number>
  backupPath?: string
  warnings?: string[]
  error?: string
}

const TABLE_NAMES = [
  'projects',
  'commands',
  'chains',
  'triggers',
  'run_history',
  'notes',
  'preferences',
  'engine_indexes',
  'engine_search_sessions',
  'health_check_runs',
  'health_check_items',
  'bug_reports',
  'bug_context_snapshots',
  'bug_attachments',
] as const

type TableName = (typeof TABLE_NAMES)[number]

const DELETE_ORDER: TableName[] = [
  'bug_attachments',
  'bug_context_snapshots',
  'bug_reports',
  'health_check_items',
  'health_check_runs',
  'engine_search_sessions',
  'engine_indexes',
  'run_history',
  'triggers',
  'chains',
  'preferences',
  'commands',
  'notes',
  'projects',
]

const INSERT_ORDER: TableName[] = [...DELETE_ORDER].reverse()

export async function exportAllData(): Promise<ExportResult> {
  return queueWrite(async () => withSqlTiming('exportAllData', async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()

    const exportTransaction = database.transaction(() => {
      const tables: Record<string, unknown[][]> = {}
      const recordCounts: Record<string, number> = {}

      for (const tableName of TABLE_NAMES) {
        const columnNames = getColumnNames(database, tableName)
        const rows = database.prepare(`SELECT * FROM ${tableName}`).all() as Array<Record<string, unknown>>
        const orderedRows = rows.map((row) => columnNames.map((col) => row[col]))
        tables[tableName] = orderedRows
        recordCounts[tableName] = rows.length
      }

      return { tables, recordCounts }
    })

    const { tables, recordCounts } = exportTransaction()

    const data: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      platform: process.platform,
      tables,
    }

    return { success: true, data, recordCounts }
  }))
}

export async function importAllData(
  exportData: unknown,
  mode: ImportMode
): Promise<ImportResult> {
  if (mode !== 'replace' && mode !== 'merge') {
    return { success: false, recordCounts: {}, error: 'Import mode must be "replace" or "merge".' }
  }

  const validation = validateExportData(exportData)
  if (!validation.valid) {
    return { success: false, recordCounts: {}, error: validation.error }
  }

  const parsed = validation.data as ExportData
  const warnings: string[] = []

  const attachmentCount = parsed.tables['bug_attachments']?.length ?? 0
  if (attachmentCount > 0) {
    warnings.push(
      `This backup contains ${attachmentCount} external attachment record(s). External files are not included in v1 exports and will not be available after restore.`
    )
  }

  return queueWrite(async () => withSqlTiming('importAllData', async () => {
    await ensureDbInitialized()
    const database = getDbOrThrow()

    const dbPath = getDbPath()
    const backupPath = `${dbPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`

    try {
      database.pragma('wal_checkpoint(TRUNCATE)')
      await fs.copyFile(dbPath, backupPath)
    } catch (err) {
      return {
        success: false,
        recordCounts: {},
        error: `Failed to create database backup at ${backupPath}: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    const recordCounts: Record<string, number> = {}
    const rowErrors: string[] = []

    try {
      const importTransaction = database.transaction(() => {
        database.pragma('foreign_keys = OFF')

        if (mode === 'replace') {
          for (const tableName of DELETE_ORDER) {
            database.prepare(`DELETE FROM ${tableName}`).run()
          }
        }

        for (const tableName of INSERT_ORDER) {
          const rows = parsed.tables[tableName]
          if (!rows || rows.length === 0) {
            recordCounts[tableName] = 0
            continue
          }

          const currentColumns = getColumnNames(database, tableName)
          const exportColumns = getColumnNamesForExport(database, tableName, rows)
          const paddedRows = rows.map((row) => padRow(row, exportColumns, currentColumns))

          const placeholders = currentColumns.map(() => '?').join(', ')
          const columns = currentColumns.map((c) => `"${c}"`).join(', ')

          let insertStmt: Database.Statement
          if (mode === 'merge') {
            const pkColumns = getPrimaryKeyColumns(database, tableName)
            const pkCondition = pkColumns.map((c) => `"${c}"`).join(', ')
            const updateColumns = currentColumns.filter((c) => !pkColumns.includes(c))
            const setClause = updateColumns.length > 0
              ? ` DO UPDATE SET ${updateColumns.map((c) => `"${c}" = excluded."${c}"`).join(', ')}`
              : ' DO NOTHING'
            insertStmt = database.prepare(
              `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT(${pkCondition})${setClause}`
            )
          } else {
            insertStmt = database.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`)
          }

          let inserted = 0
          for (let i = 0; i < paddedRows.length; i++) {
            try {
              insertStmt.run(...paddedRows[i])
              inserted++
            } catch (rowErr) {
              const msg = `Failed to insert row ${i} into ${tableName}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`
              console.warn(`[export] ${msg}`)
              rowErrors.push(msg)
            }
          }
          recordCounts[tableName] = inserted
        }

        database.pragma('foreign_keys = ON')
      })

      importTransaction()

      const fkViolations = database.pragma('foreign_key_check') as Array<Record<string, unknown>>
      if (fkViolations.length > 0) {
        warnings.push(
          `${fkViolations.length} foreign key violation(s) detected after import. Some records may have broken references.`
        )
      }

      if (rowErrors.length > 0) {
        warnings.push(`${rowErrors.length} row(s) failed to import.`)
      }

      return { success: true, recordCounts, backupPath, warnings }
    } catch (err) {
      return {
        success: false,
        recordCounts: {},
        backupPath,
        error: `Import transaction failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }))
}

const columnNameCache = new Map<string, string[]>()

function getColumnNames(database: Database.Database, tableName: string): string[] {
  const cacheKey = `columns:${tableName}`
  const cached = columnNameCache.get(cacheKey)
  if (cached) return cached

  const rows = database.pragma(`table_info(${tableName})`) as Array<{ name: string }>
  const names = rows.map((r) => r.name)
  columnNameCache.set(cacheKey, names)
  return names
}

const pkCache = new Map<string, string[]>()

function getPrimaryKeyColumns(database: Database.Database, tableName: string): string[] {
  const cacheKey = `pk:${tableName}`
  const cached = pkCache.get(cacheKey)
  if (cached) return cached

  const rows = database.pragma(`table_info(${tableName})`) as Array<{ name: string; pk: number }>
  const pkNames = rows.filter((r) => r.pk > 0).sort((a, b) => a.pk - b.pk).map((r) => r.name)
  pkCache.set(cacheKey, pkNames)
  return pkNames
}

function getColumnNamesForExport(database: Database.Database, tableName: string, rows: unknown[][]): string[] {
  const allColumns = getColumnNames(database, tableName)
  if (rows.length === 0) return allColumns
  return allColumns.slice(0, rows[0].length)
}

function padRow(row: unknown[], exportColumns: string[], currentColumns: string[]): unknown[] {
  return currentColumns.map((col) => {
    const idx = exportColumns.indexOf(col)
    return idx >= 0 ? row[idx] : null
  })
}

interface ValidationResult {
  valid: boolean
  data?: ExportData
  error?: string
}

function validateExportData(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid export data: must be a non-null object.' }
  }

  const data = raw as Record<string, unknown>

  if (typeof data.version !== 'number' || !Number.isFinite(data.version) || data.version < 1) {
    return { valid: false, error: 'Invalid export data: version must be a positive finite number.' }
  }

  if (data.version > EXPORT_VERSION) {
    return {
      valid: false,
      error: `Backup version (${data.version}) is newer than the current app version (${EXPORT_VERSION}). Backups from newer app versions cannot be imported.`,
    }
  }

  if (typeof data.exportedAt !== 'string') {
    return { valid: false, error: 'Invalid export data: missing exportedAt timestamp.' }
  }

  if (typeof data.tables !== 'object' || data.tables === null || Array.isArray(data.tables)) {
    return { valid: false, error: 'Invalid export data: missing tables object.' }
  }

  const tables = data.tables as Record<string, unknown>

  for (const tableName of TABLE_NAMES) {
    if (!(tableName in tables)) {
      tables[tableName] = []
    }
  }

  for (const tableName of TABLE_NAMES) {
    if (!Array.isArray(tables[tableName])) {
      return {
        valid: false,
        error: `Invalid export data: table "${tableName}" is not an array.`,
      }
    }
  }

  return { valid: true, data: data as unknown as ExportData }
}
