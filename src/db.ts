import Database from 'better-sqlite3';
import * as path from 'path';
import type { FileRecord } from './types.js';
import { ensureDir } from './utils.js';

const SCHEMA_VERSION = 1;

const SCHEMA = `
-- Files table with content
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER,
    mtime_ms INTEGER,
    content_hash TEXT,
    language TEXT,
    is_binary INTEGER DEFAULT 0,
    indexed_at INTEGER,
    content TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    path,
    filename,
    language,
    content,
    content='files',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Schema version
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
`;

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = this.initialize();
  }

  private initialize(): Database.Database {
    ensureDir(path.dirname(this.dbPath));

    const db = new Database(this.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(SCHEMA);

    const versionRow = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    if (!versionRow) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }

    return db;
  }

  /**
   * Insert or update a file
   */
  upsertFile(file: {
    path: string;
    filename: string;
    extension: string | null;
    size_bytes: number;
    mtime_ms: number;
    content_hash: string | null;
    language: string | null;
    is_binary: boolean;
    content?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, filename, extension, size_bytes, mtime_ms, content_hash, language, is_binary, indexed_at, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        filename = excluded.filename,
        extension = excluded.extension,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        content_hash = excluded.content_hash,
        language = excluded.language,
        is_binary = excluded.is_binary,
        indexed_at = excluded.indexed_at,
        content = excluded.content
    `);

    const result = stmt.run(
      file.path,
      file.filename,
      file.extension,
      file.size_bytes,
      file.mtime_ms,
      file.content_hash,
      file.language,
      file.is_binary ? 1 : 0,
      Date.now(),
      file.content || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Batch insert files in a transaction
   */
  upsertFiles(files: Array<{
    path: string;
    filename: string;
    extension: string | null;
    size_bytes: number;
    mtime_ms: number;
    content_hash: string | null;
    language: string | null;
    is_binary: boolean;
    content?: string;
  }>): number {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, filename, extension, size_bytes, mtime_ms, content_hash, language, is_binary, indexed_at, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        filename = excluded.filename,
        extension = excluded.extension,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        content_hash = excluded.content_hash,
        language = excluded.language,
        is_binary = excluded.is_binary,
        indexed_at = excluded.indexed_at,
        content = excluded.content
    `);

    const insertMany = this.db.transaction((items: typeof files) => {
      let count = 0;
      for (const file of items) {
        stmt.run(
          file.path,
          file.filename,
          file.extension,
          file.size_bytes,
          file.mtime_ms,
          file.content_hash,
          file.language,
          file.is_binary ? 1 : 0,
          Date.now(),
          file.content || null
        );
        count++;
      }
      return count;
    });

    return insertMany(files);
  }

  /**
   * Get file by path
   */
  getFileByPath(filePath: string): FileRecord | undefined {
    return this.db.prepare('SELECT * FROM files WHERE path = ?').get(filePath) as FileRecord | undefined;
  }

  /**
   * Delete file by path
   */
  deleteFile(filePath: string): boolean {
    const result = this.db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
    return result.changes > 0;
  }

  /**
   * Delete all files
   */
  deleteAllFiles(): number {
    const result = this.db.prepare('DELETE FROM files').run();
    return result.changes;
  }

  /**
   * Full-text search using FTS5
   */
  searchFts(query: string, limit: number = 100): FileRecord[] {
    // Escape special FTS5 characters
    const escaped = query.replace(/['"()]/g, '').trim();

    // Use FTS5 MATCH
    const stmt = this.db.prepare(`
      SELECT f.*
      FROM files f
      JOIN files_fts fts ON f.path = fts.path
      WHERE files_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    try {
      return stmt.all(escaped, limit) as FileRecord[];
    } catch {
      // Fallback to LIKE if FTS fails
      return this.searchLike(query, limit);
    }
  }

  /**
   * Fallback LIKE search
   */
  searchLike(query: string, limit: number = 100): FileRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM files
      WHERE content LIKE ? OR path LIKE ?
      LIMIT ?
    `);

    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern, limit) as FileRecord[];
  }

  /**
   * Get all file paths
   */
  getAllPaths(): Set<string> {
    const rows = this.db.prepare('SELECT path FROM files').all() as { path: string }[];
    return new Set(rows.map((r) => r.path));
  }

  /**
   * Get hash-to-path mapping (for incremental indexing)
   */
  getHashMap(): Map<string, string> {
    const rows = this.db.prepare('SELECT path, content_hash FROM files WHERE content_hash IS NOT NULL').all() as {
      path: string;
      content_hash: string;
    }[];

    return new Map(rows.map((r) => [r.content_hash, r.path]));
  }

  /**
   * Get paths modified before a given mtime
   */
  getPathsOlderThan(mtimeMs: number): string[] {
    const rows = this.db.prepare('SELECT path FROM files WHERE mtime_ms < ?').all(mtimeMs) as { path: string }[];
    return rows.map((r) => r.path);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalFiles: number;
    totalSizeBytes: number;
    byLanguage: Record<string, number>;
    indexedAt: string;
  } {
    const totalRow = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size
      FROM files
    `).get() as { count: number; total_size: number };

    const langRows = this.db.prepare(`
      SELECT language, COUNT(*) as count
      FROM files
      WHERE language IS NOT NULL
      GROUP BY language
      ORDER BY count DESC
    `).all() as { language: string; count: number }[];

    const byLanguage: Record<string, number> = {};
    for (const row of langRows) {
      byLanguage[row.language] = row.count;
    }

    const indexedRow = this.db.prepare(`
      SELECT MIN(indexed_at) as first_indexed FROM files
    `).get() as { first_indexed: number | null };

    return {
      totalFiles: totalRow.count,
      totalSizeBytes: totalRow.total_size,
      byLanguage,
      indexedAt: indexedRow.first_indexed
        ? new Date(indexedRow.first_indexed).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Close connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Optimize database
   */
  optimize(): void {
    this.db.pragma('optimize');
  }
}
