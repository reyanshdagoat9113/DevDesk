import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { FileInfo, IndexResult, SearchOptions, SearchResult, FileSearchResult, RustFileResult } from './types.js';
import { DatabaseManager } from './db.js';
import { detectLanguage, getExtension, getFilename, shouldIndex } from './lang.js';
import { getScannerBinaryPath, normalizePath, measureTime, getDefaultDbPath, resolvePath } from './utils.js';

export interface IndexOptions {
  repo: string;
  db?: string;
  incremental?: boolean;
}

/**
 * Index a repository
 */
export async function indexRepository(options: IndexOptions): Promise<IndexResult> {
  const { repo, incremental = false } = options;
  const dbPath = options.db || getDefaultDbPath(repo);
  const repoPath = resolvePath(repo);

  if (!fs.existsSync(repoPath)) {
    return {
      ok: false,
      repo: repoPath,
      db: dbPath,
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      warnings: [`Repository path does not exist: ${repoPath}`],
    };
  }

  const { result, durationMs } = await measureTime(async () => {
    const db = new DatabaseManager(dbPath);

    // For incremental, get existing hashes
    const existingHashMap = incremental ? db.getHashMap() : new Map();
    const existingPaths = incremental ? db.getAllPaths() : new Set();

    // Clear for full reindex
    if (!incremental) {
      db.deleteAllFiles();
    }

    // Run Rust scanner with --content flag for indexing
    const files = await runScanner(repoPath, true);

    const toIndex: Array<{
      path: string;
      filename: string;
      extension: string | null;
      size_bytes: number;
      mtime_ms: number;
      content_hash: string | null;
      language: string | null;
      is_binary: boolean;
      content?: string;
    }> = [];

    let skipped = 0;
    const warnings: string[] = [];

    for (const file of files) {
      // Skip binary files
      if (file.is_binary) {
        skipped++;
        continue;
      }

      // Skip unchanged files (incremental)
      if (incremental && file.content_hash && existingHashMap.has(file.content_hash)) {
        existingPaths.delete(file.path); // Mark as still exists
        continue;
      }

      // Detect language in TypeScript
      const language = detectLanguage(file.filename, file.extension);

      // Skip non-indexable languages
      if (!shouldIndex(language)) {
        skipped++;
        continue;
      }

      toIndex.push({
        path: file.path,
        filename: file.filename,
        extension: file.extension,
        size_bytes: file.size_bytes,
        mtime_ms: file.mtime_ms,
        content_hash: file.content_hash,
        language,
        is_binary: false,
        content: file.content,
      });
    }

    // Remove deleted files (incremental)
    if (incremental) {
      for (const oldPath of existingPaths) {
        db.deleteFile(oldPath as string);
      }
    }

    // Batch insert
    const indexed = db.upsertFiles(toIndex);

    db.optimize();
    db.close();

    if (skipped > 0) {
      warnings.push(`Skipped ${skipped} binary/unknown files`);
    }

    return { indexed, skipped, warnings };
  });

  return {
    ok: true,
    repo: normalizePath(repoPath),
    db: normalizePath(dbPath),
    filesIndexed: result.indexed,
    filesSkipped: result.skipped,
    durationMs,
    warnings: result.warnings,
  };
}

/**
 * Run the Rust scanner
 */
async function runScanner(repoPath: string, includeContent: boolean = false): Promise<FileInfo[]> {
  const scannerPath = getScannerBinaryPath();

  if (!fs.existsSync(scannerPath)) {
    throw new Error(`Scanner binary not found: ${scannerPath}. Run 'npm run build:rust' first.`);
  }

  const args = ['scan', '--path', repoPath];
  if (includeContent) {
    args.push('--content');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(scannerPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const files: FileInfo[] = [];
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const info: FileInfo = JSON.parse(line);
          files.push(info);
        } catch {
          // Skip invalid JSON
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Scanner failed (${code}): ${stderr}`));
      } else {
        resolve(files);
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Search the index
 */
export async function searchIndex(options: SearchOptions): Promise<SearchResult> {
  const { db: dbPath, query, regex, limit = 100 } = options;

  const { result, durationMs } = await measureTime(async () => {
    const db = new DatabaseManager(dbPath);

    // Get matching files from FTS5
    const files = db.searchFts(query, limit * 2);

    if (regex) {
      // Use Rust for regex search
      const filePaths = files.map((f) => f.path);
      const rustResults = await runRegexSearch(query, filePaths);

      db.close();

      return rustResults.slice(0, limit).map((r) => ({
        path: r.path,
        language: files.find((f) => f.path === r.path)?.language || null,
        score: 1.0,
        matches: r.matches.map((m) => ({
          line: m.line,
          column: m.column,
          snippet: m.text,
          contextBefore: m.before,
          contextAfter: m.after,
        })),
      }));
    }

    db.close();

    // Simple FTS results
    return files.slice(0, limit).map((file) => ({
      path: file.path,
      language: file.language,
      score: 1.0,
      matches: [],
    }));
  });

  return {
    ok: true,
    query,
    results: result,
    totalMatches: result.length,
    durationMs,
  };
}

/**
 * Run regex search using Rust
 */
async function runRegexSearch(pattern: string, filePaths: string[]): Promise<RustFileResult[]> {
  const scannerPath = getScannerBinaryPath();

  if (!fs.existsSync(scannerPath)) {
    throw new Error(`Scanner binary not found: ${scannerPath}`);
  }

  return new Promise((resolve, reject) => {
    const args = ['search', '--pattern', pattern, '--files', filePaths.join(',')];

    const proc = spawn(scannerPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Search failed (${code}): ${stderr}`));
        return;
      }

      try {
        const results: RustFileResult[] = JSON.parse(stdout);
        resolve(results);
      } catch {
        resolve([]);
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Get database stats
 */
export function getStats(dbPath: string) {
  const db = new DatabaseManager(dbPath);
  const stats = db.getStats();
  db.close();

  return {
    ok: true,
    db: normalizePath(dbPath),
    stats,
  };
}
