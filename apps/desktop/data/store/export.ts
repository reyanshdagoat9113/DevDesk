import fs from 'node:fs/promises'

import type Database from 'better-sqlite3'

import { deleteAttachmentFile } from './attachments'
import { DATA_VERSION } from '../model'
import { ensureDbInitialized, getDbOrThrow, queueWrite, withSqlTiming } from './core'
import { getDbPath } from './shared'

export const EXPORT_VERSION = DATA_VERSION
export const EXPORT_FORMAT_VERSION = 2 as const

export type ImportMode = 'replace' | 'merge'

export interface ExportHeader {
  formatVersion: typeof EXPORT_FORMAT_VERSION
  version: number
  exportedAt: string
  platform: string
}

export interface ExportTable {
  columns: string[]
  rows: unknown[][]
}

/**
 * The current, schema-safe export format. Rows retain a compact array shape,
 * while `columns` makes their meaning independent of SQLite column order.
 */
export interface ExportData {
  formatVersion: typeof EXPORT_FORMAT_VERSION
  version: number
  exportedAt: string
  platform: string
  tables: Record<string, ExportTable>
}

/** Positional v1 exports remain importable for existing user backups. */
export interface LegacyExportData {
  formatVersion?: 1
  version: number
  exportedAt: string
  platform: string
  tables: Record<string, unknown[][]>
}

export type ImportableExportData = ExportData | LegacyExportData

export type ExportResult =
  | {
      success: true
      data: ExportData
      recordCounts: Record<string, number>
    }
  | {
      success: false
      error: string
    }

export interface ImportResult {
  success: boolean
  recordCounts: Record<string, number>
  backupPath?: string
  warnings?: string[]
  error?: string
}

export interface ExportToFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  recordCounts?: Record<string, number>
  error?: string
}

export interface ImportPreviewResult {
  success: boolean
  canceled?: boolean
  data?: ImportableExportData
  recordCounts?: Record<string, number>
  warnings?: string[]
  error?: string
}

export const TABLE_NAMES = [
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
      const tables: Record<string, ExportTable> = {}
      const recordCounts: Record<string, number> = {}

      for (const tableName of TABLE_NAMES) {
        const columnNames = getColumnNames(database, tableName)
        const rows = database.prepare(`SELECT * FROM ${tableName}`).all() as Array<Record<string, unknown>>
        const orderedRows = rows.map((row) => columnNames.map((col) => row[col]))
        tables[tableName] = { columns: columnNames, rows: orderedRows }
        recordCounts[tableName] = rows.length
      }

      return { tables, recordCounts }
    })

    const { tables, recordCounts } = exportTransaction()

    const data: ExportData = {
      formatVersion: EXPORT_FORMAT_VERSION,
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

  const parsed = validation.data!
  const warnings: string[] = []

  const attachmentCount = getExportRows(parsed.tables['bug_attachments']).length
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
    const attachmentPaths = mode === 'replace'
      ? (database.prepare('SELECT file_path FROM bug_attachments').all() as Array<{ file_path: string }>)
      : []

    try {
      const importTransaction = database.transaction(() => {
        database.pragma('foreign_keys = OFF')

        if (mode === 'replace') {
          for (const tableName of DELETE_ORDER) {
            database.prepare(`DELETE FROM ${tableName}`).run()
          }
        }

        for (const tableName of INSERT_ORDER) {
          const table = parsed.tables[tableName]
          const rows = getExportRows(table)
          if (!rows || rows.length === 0) {
            recordCounts[tableName] = 0
            continue
          }

          const currentColumns = getColumnNames(database, tableName)
          const exportColumns = getExportColumnNames(database, tableName, table, rows)
          const paddedRows = rows.map((row) => mapRowToCurrentColumns(row, exportColumns, currentColumns))

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

        if (rowErrors.length > 0) {
          throw new Error(`${rowErrors.length} row(s) failed to import. First: ${rowErrors[0]}`)
        }

        const fkViolations = database.pragma('foreign_key_check') as Array<Record<string, unknown>>
        if (fkViolations.length > 0) {
          throw new Error(
            `${fkViolations.length} foreign key violation(s) detected after import. Import rolled back.`,
          )
        }
      })

      importTransaction()

      for (const { file_path: filePath } of attachmentPaths) {
        const isStillReferenced = database
          .prepare('SELECT 1 FROM bug_attachments WHERE file_path = ? LIMIT 1')
          .get(filePath)
        if (isStillReferenced) continue

        try {
          deleteAttachmentFile(filePath)
        } catch {
          // A missing or malformed attachment must not make an imported database unusable.
        }
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

function getExportColumnNames(
  database: Database.Database,
  tableName: string,
  table: ExportTable | unknown[][],
  rows: unknown[][],
): string[] {
  if (!Array.isArray(table)) return table.columns

  // v1 exported positional rows without headers. Their original column order
  // can only be inferred as the then-current schema prefix.
  const allColumns = getColumnNames(database, tableName)
  if (rows.length === 0) return allColumns
  return allColumns.slice(0, rows[0].length)
}

function mapRowToCurrentColumns(row: unknown[], exportColumns: string[], currentColumns: string[]): unknown[] {
  return currentColumns.map((col) => {
    const idx = exportColumns.indexOf(col)
    return idx >= 0 ? row[idx] : null
  })
}

function getExportRows(table: ExportTable | unknown[][] | undefined): unknown[][] {
  if (!table) return []
  return Array.isArray(table) ? table : table.rows
}

interface ValidationResult {
  valid: boolean
  data?: ImportableExportData
  error?: string
}

export function validateExportData(raw: unknown): ValidationResult {
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

  const isV2 = data.formatVersion === EXPORT_FORMAT_VERSION
  if ('formatVersion' in data && !isV2 && data.formatVersion !== 1) {
    return {
      valid: false,
      error: `Invalid export data: unsupported payload format version (${String(data.formatVersion)}).`,
    }
  }

  for (const tableName of TABLE_NAMES) {
    if (!(tableName in tables)) {
      tables[tableName] = isV2 ? { columns: [], rows: [] } : []
    }
  }

  for (const tableName of TABLE_NAMES) {
    const table = tables[tableName]
    if (!isV2 && !Array.isArray(table)) {
      return {
        valid: false,
        error: `Invalid export data: table "${tableName}" is not an array.`,
      }
    }

    if (isV2) {
      if (typeof table !== 'object' || table === null || Array.isArray(table)) {
        return { valid: false, error: `Invalid export data: table "${tableName}" must contain columns and rows.` }
      }

      const { columns, rows } = table as Record<string, unknown>
      if (!Array.isArray(columns) || columns.some((column) => typeof column !== 'string' || column.length === 0)) {
        return { valid: false, error: `Invalid export data: table "${tableName}" has invalid column headers.` }
      }
      if (new Set(columns).size !== columns.length) {
        return { valid: false, error: `Invalid export data: table "${tableName}" has duplicate column headers.` }
      }
      if (!Array.isArray(rows)) {
        return { valid: false, error: `Invalid export data: table "${tableName}" rows are not an array.` }
      }
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        if (!Array.isArray(row) || row.length !== columns.length) {
          return {
            valid: false,
            error: `Invalid export data: table "${tableName}" row ${rowIndex} does not match its ${columns.length} column header(s).`,
          }
        }
      }
    }
  }

  return { valid: true, data: data as unknown as ImportableExportData }
}
