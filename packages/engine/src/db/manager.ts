import Database from 'better-sqlite3';
import * as path from 'path';
import type {
  FileRecord,
  GitHotspotRecord,
  RankedFileResult,
  RepositoryRecord,
} from '../types.js';
import { ensureDir, normalizePath } from '../utils.js';
import { SCHEMA, SCHEMA_VERSION } from './schema.js';

function parseContributors(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function toRepositoryRecord(row: {
  id: number;
  path: string;
  is_git: number;
  branch: string | null;
  total_commits: number | null;
  contributors_json: string | null;
  last_indexed_at: number | null;
}): RepositoryRecord {
  return {
    id: row.id,
    path: row.path,
    isGit: row.is_git === 1,
    branch: row.branch,
    totalCommits: row.total_commits || 0,
    contributors: parseContributors(row.contributors_json),
    lastIndexedAt: row.last_indexed_at,
  };
}

function toHotspotRecord(row: {
  id: number;
  repository_path: string;
  path: string;
  score: number;
  commits: number;
  recency: number;
  risk: 'low' | 'medium' | 'high';
  updated_at: number;
}): GitHotspotRecord {
  return {
    id: row.id,
    repositoryPath: row.repository_path,
    path: row.path,
    score: row.score,
    commits: row.commits,
    recency: row.recency,
    risk: row.risk,
    updatedAt: row.updated_at,
  };
}

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

    const versionRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined;

    if (!versionRow) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    } else if (versionRow.version < SCHEMA_VERSION) {
      db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
    }

    return db;
  }

  upsertRepository(input: {
    path: string;
    isGit: boolean;
    branch?: string | null;
    totalCommits?: number;
    contributors?: string[];
    lastIndexedAt?: number;
  }): number {
    const repoPath = normalizePath(input.path);
    const stmt = this.db.prepare(`
      INSERT INTO repositories (
        path, is_git, branch, total_commits, contributors_json, last_indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        is_git = excluded.is_git,
        branch = excluded.branch,
        total_commits = excluded.total_commits,
        contributors_json = excluded.contributors_json,
        last_indexed_at = excluded.last_indexed_at
    `);

    const result = stmt.run(
      repoPath,
      input.isGit ? 1 : 0,
      input.branch ?? null,
      input.totalCommits ?? 0,
      JSON.stringify(input.contributors || []),
      input.lastIndexedAt ?? Date.now()
    );

    return Number(result.lastInsertRowid || 0);
  }

  getRepositoryByPath(repoPath: string): RepositoryRecord | undefined {
    const normalized = normalizePath(repoPath);
    const row = this.db
      .prepare('SELECT * FROM repositories WHERE path = ?')
      .get(normalized) as
      | {
          id: number;
          path: string;
          is_git: number;
          branch: string | null;
          total_commits: number | null;
          contributors_json: string | null;
          last_indexed_at: number | null;
        }
      | undefined;

    return row ? toRepositoryRecord(row) : undefined;
  }

  getPrimaryRepository(): RepositoryRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM repositories ORDER BY last_indexed_at DESC, id DESC LIMIT 1')
      .get() as
      | {
          id: number;
          path: string;
          is_git: number;
          branch: string | null;
          total_commits: number | null;
          contributors_json: string | null;
          last_indexed_at: number | null;
        }
      | undefined;

    return row ? toRepositoryRecord(row) : undefined;
  }

  clearGitHotspots(repoPath: string): number {
    const normalized = normalizePath(repoPath);
    const result = this.db.prepare('DELETE FROM git_hotspots WHERE repository_path = ?').run(normalized);
    return result.changes;
  }

  replaceGitHotspots(
    repoPath: string,
    hotspots: Array<{
      path: string;
      score: number;
      commits: number;
      recency: number;
      risk: 'low' | 'medium' | 'high';
    }>
  ): number {
    const normalizedRepoPath = normalizePath(repoPath);
    const deleteStmt = this.db.prepare('DELETE FROM git_hotspots WHERE repository_path = ?');
    const insertStmt = this.db.prepare(`
      INSERT INTO git_hotspots (
        repository_path, path, score, commits, recency, risk, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repository_path, path) DO UPDATE SET
        score = excluded.score,
        commits = excluded.commits,
        recency = excluded.recency,
        risk = excluded.risk,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((items: typeof hotspots) => {
      deleteStmt.run(normalizedRepoPath);

      let count = 0;
      for (const hotspot of items) {
        insertStmt.run(
          normalizedRepoPath,
          normalizePath(hotspot.path),
          hotspot.score,
          hotspot.commits,
          hotspot.recency,
          hotspot.risk,
          Date.now()
        );
        count++;
      }

      return count;
    });

    return insertMany(hotspots);
  }

  getGitHotspots(repoPath?: string): GitHotspotRecord[] {
    const rows = repoPath
      ? (this.db
          .prepare('SELECT * FROM git_hotspots WHERE repository_path = ? ORDER BY score DESC')
          .all(normalizePath(repoPath)) as Array<{
            id: number;
            repository_path: string;
            path: string;
            score: number;
            commits: number;
            recency: number;
            risk: 'low' | 'medium' | 'high';
            updated_at: number;
          }>)
      : (this.db
          .prepare('SELECT * FROM git_hotspots ORDER BY score DESC')
          .all() as Array<{
            id: number;
            repository_path: string;
            path: string;
            score: number;
            commits: number;
            recency: number;
            risk: 'low' | 'medium' | 'high';
            updated_at: number;
          }>);

    return rows.map(toHotspotRecord);
  }

  getGitHotspotMap(repoPath?: string): Map<string, GitHotspotRecord> {
    const map = new Map<string, GitHotspotRecord>();
    for (const hotspot of this.getGitHotspots(repoPath)) {
      map.set(hotspot.path, hotspot);
    }
    return map;
  }

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
      normalizePath(file.path),
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

    return Number(result.lastInsertRowid || 0);
  }

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
          normalizePath(file.path),
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

  getFileByPath(filePath: string): FileRecord | undefined {
    return this.db
      .prepare('SELECT * FROM files WHERE path = ?')
      .get(normalizePath(filePath)) as FileRecord | undefined;
  }

  deleteFile(filePath: string): boolean {
    const result = this.db.prepare('DELETE FROM files WHERE path = ?').run(normalizePath(filePath));
    return result.changes > 0;
  }

  deleteAllFiles(): number {
    const result = this.db.prepare('DELETE FROM files').run();
    return result.changes;
  }

  searchFts(query: string, limit: number = 100): FileRecord[] {
    const escaped = query.replace(/['"()]/g, '').trim();

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
      return this.searchLike(query, limit);
    }
  }

  searchLike(query: string, limit: number = 100): FileRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM files
      WHERE content LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\'
      LIMIT ?
    `);

    const escaped = query.replace(/([\\%_])/g, '\\$1')
    const pattern = `%${escaped}%`;
    return stmt.all(pattern, pattern, limit) as FileRecord[];
  }

  searchRanked(
    query: string,
    options: {
      limit?: number;
      preferLanguages?: string[];
      boostRecent?: boolean;
    } = {}
  ): RankedFileResult[] {
    const { limit = 100, preferLanguages = [], boostRecent = true } = options;
    const escaped = query.replace(/['"()]/g, '').trim();
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    try {
      const stmt = this.db.prepare(`
        SELECT f.*, bm25(files_fts) as bm25_score
        FROM files f
        JOIN files_fts fts ON f.path = fts.path
        WHERE files_fts MATCH ?
        ORDER BY bm25_score
        LIMIT ?
      `);

      const rows = stmt.all(escaped, limit * 2) as Array<FileRecord & { bm25_score: number }>;

      const results = rows.map((row) => {
        const rawBm25 = -row.bm25_score;
        const bm25Normalized = Math.min(1, Math.max(0, rawBm25 / 10));

        let score = bm25Normalized;

        if (row.language && preferLanguages.includes(row.language)) {
          score *= 1.5;
        }

        if (boostRecent && row.mtime_ms > monthAgo) {
          const ageMs = now - row.mtime_ms;
          const ageDays = ageMs / (24 * 60 * 60 * 1000);
          const recencyBoost = 1 + (1 - ageDays / 30) * 0.3;
          score *= recencyBoost;
        }

        const pathDepth = (row.path.match(/\//g) || []).length;
        if (pathDepth <= 2) {
          score *= 1.2;
        }

        return { ...row, score: Math.round(score * 1000) / 1000 };
      });

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch {
      return this.searchLike(query, limit).map((row) => ({
        ...row,
        score: 0.5,
      }));
    }
  }

  getAllPaths(): Set<string> {
    const rows = this.db.prepare('SELECT path FROM files').all() as { path: string }[];
    return new Set(rows.map((r) => normalizePath(r.path)));
  }

  /** content_hash → path (last write wins). Prefer getPathHashMap for incremental identity. */
  getHashMap(): Map<string, string> {
    const rows = this.db.prepare('SELECT path, content_hash FROM files WHERE content_hash IS NOT NULL').all() as {
      path: string;
      content_hash: string;
    }[];

    return new Map(rows.map((r) => [r.content_hash, normalizePath(r.path)]));
  }

  /** path → content_hash — authoritative identity for incremental indexing. */
  getPathHashMap(): Map<string, string | null> {
    const rows = this.db.prepare('SELECT path, content_hash FROM files').all() as {
      path: string;
      content_hash: string | null;
    }[];

    return new Map(rows.map((r) => [normalizePath(r.path), r.content_hash]));
  }

  getPathsOlderThan(mtimeMs: number): string[] {
    const rows = this.db.prepare('SELECT path FROM files WHERE mtime_ms < ?').all(mtimeMs) as { path: string }[];
    return rows.map((r) => normalizePath(r.path));
  }

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

  close(): void {
    this.db.close();
  }

  optimize(): void {
    this.db.pragma('optimize');
  }
}
