import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseManager } from './db.js';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-db-test-'));
    dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseManager(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('creates database file', () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

    it('creates files table with correct schema', () => {
    const id = db.upsertFile({
      path: '/src/test.ts',
      filename: 'test.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'hash1',
      language: 'typescript',
      is_binary: false,
      content: 'const x = 1;',
    });

    const file = db.getFileByPath('/src/test.ts');
    expect(file).toBeDefined();
    expect(file?.filename).toBe('test.ts');
    expect(file?.language).toBe('typescript');
  });

  it('creates FTS5 virtual table', () => {
    db.upsertFile({
      path: '/src/search.ts',
      filename: 'search.ts',
      extension: 'ts',
      size_bytes: 200,
      mtime_ms: Date.now(),
      content_hash: 'hash2',
      language: 'typescript',
      is_binary: false,
      content: 'export function search() { return true; }',
    });

    const results = db.searchFts('search', 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('creates sync triggers', () => {
    db.upsertFile({
      path: '/src/trigger.ts',
      filename: 'trigger.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'hash3',
      language: 'typescript',
      is_binary: false,
      content: 'trigger test content',
    });

    // Delete should remove from FTS
    db.deleteFile('/src/trigger.ts');
    const results = db.searchFts('trigger', 10);
    expect(results.length).toBe(0);
  });
});

  describe('upsertFile', () => {
    it('inserts a new file record', () => {
    const id = db.upsertFile({
      path: '/src/app.ts',
      filename: 'app.ts',
      extension: 'ts',
      size_bytes: 1024,
      mtime_ms: Date.now(),
      content_hash: 'abc123',
      language: 'typescript',
      is_binary: false,
      content: 'const x = 1;',
    });

    expect(id).toBeGreaterThan(0);
    expect(db.getStats().totalFiles).toBe(1);
  });

  it('updates existing file on conflict (same path)', () => {
    db.upsertFile({
      path: '/src/app.ts',
      filename: 'app.ts',
      extension: 'ts',
      size_bytes: 1024,
      mtime_ms: Date.now(),
      content_hash: 'abc123',
      language: 'typescript',
      is_binary: false,
      content: 'const x = 1;',
    });

    db.upsertFile({
      path: '/src/app.ts',
      filename: 'app_updated.ts',
      extension: 'ts',
      size_bytes: 2048,
      mtime_ms: Date.now(),
      content_hash: 'def456',
      language: 'typescript',
      is_binary: false,
      content: 'const x = 2;',
    });

    const stats = db.getStats();
    expect(stats.totalFiles).toBe(1); // Still 1, not 2
    expect(stats.totalSizeBytes).toBe(2048); // Updated value
  });

  it('handles null extension', () => {
    const id = db.upsertFile({
      path: '/src/Dockerfile',
      filename: 'Dockerfile',
      extension: null,
      size_bytes: 256,
      mtime_ms: Date.now(),
      content_hash: 'xyz789',
      language: 'dockerfile',
      is_binary: false,
      content: 'FROM node:18',
    });

    expect(id).toBeGreaterThan(0);
  });

  it('handles null content_hash', () => {
    const id = db.upsertFile({
      path: '/src/binary.exe',
      filename: 'binary.exe',
      extension: 'exe',
      size_bytes: 1000,
      mtime_ms: Date.now(),
      content_hash: null,
      language: null,
      is_binary: true,
    });

    expect(id).toBeGreaterThan(0);
  });
});

  describe('upsertFiles (batch)', () => {
    it('inserts multiple files in a transaction', () => {
    const count = db.upsertFiles([
      {
        path: '/src/a.ts',
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'hash1',
        language: 'typescript',
        is_binary: false,
        content: 'export const a = 1;',
      },
      {
        path: '/src/b.ts',
        filename: 'b.ts',
        extension: 'ts',
        size_bytes: 200,
        mtime_ms: Date.now(),
        content_hash: 'hash2',
        language: 'typescript',
        is_binary: false,
        content: 'export const b = 2;',
      },
      {
        path: '/src/c.ts',
        filename: 'c.ts',
        extension: 'ts',
        size_bytes: 300,
        mtime_ms: Date.now(),
        content_hash: 'hash3',
        language: 'typescript',
        is_binary: false,
        content: 'export const c = 3;',
      },
    ]);

    expect(count).toBe(3);
    expect(db.getStats().totalFiles).toBe(3);
  });

  it('handles empty array', () => {
    const count = db.upsertFiles([]);
    expect(count).toBe(0);
  });

  it('handles updates in batch', () => {
    db.upsertFiles([
      {
        path: '/src/a.ts',
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'hash1',
        language: 'typescript',
        is_binary: false,
        content: 'export const a = 1;',
      },
    ]);

    // Update the same file
    db.upsertFiles([
      {
        path: '/src/a.ts',
        filename: 'a_updated.ts',
        extension: 'ts',
        size_bytes: 200,
        mtime_ms: Date.now(),
        content_hash: 'hash2',
        language: 'typescript',
        is_binary: false,
        content: 'export const a = 2;',
      },
    ]);

    const stats = db.getStats();
    expect(stats.totalFiles).toBe(1);
  });
});

  describe('getFileByPath', () => {
    it('retrieves file by exact path', () => {
    db.upsertFile({
      path: '/src/main.rs',
      filename: 'main.rs',
      extension: 'rs',
      size_bytes: 500,
      mtime_ms: 1234567890000,
      content_hash: 'rusthash',
      language: 'rust',
      is_binary: false,
      content: 'fn main() {}',
    });

    const file = db.getFileByPath('/src/main.rs');
    expect(file).toBeDefined();
    expect(file?.filename).toBe('main.rs');
    expect(file?.language).toBe('rust');
    expect(file?.content).toBe('fn main() {}');
    expect(file?.mtime_ms).toBe(1234567890000);
  });

  it('returns undefined for non-existent path', () => {
    const file = db.getFileByPath('/nonexistent/file.txt');
    expect(file).toBeUndefined();
  });

  it('is case-sensitive for paths', () => {
    db.upsertFile({
      path: '/src/CaseSensitive.ts',
      filename: 'CaseSensitive.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'hash',
      language: 'typescript',
      is_binary: false,
    });

    expect(db.getFileByPath('/src/casesensitive.ts')).toBeUndefined();
    expect(db.getFileByPath('/src/CaseSensitive.ts')).toBeDefined();
  });
});

  describe('deleteFile', () => {
    it('deletes file by path', () => {
    db.upsertFile({
      path: '/src/temp.ts',
      filename: 'temp.ts',
      extension: 'ts',
      size_bytes: 50,
      mtime_ms: Date.now(),
      content_hash: 'temphash',
      language: 'typescript',
      is_binary: false,
      content: 'temp',
    });

    expect(db.getStats().totalFiles).toBe(1);

    const deleted = db.deleteFile('/src/temp.ts');
    expect(deleted).toBe(true);
    expect(db.getStats().totalFiles).toBe(0);
  });

  it('returns false for non-existent file', () => {
    const deleted = db.deleteFile('/nonexistent/file.txt');
    expect(deleted).toBe(false);
  });

  it('removes from FTS index on delete', () => {
    db.upsertFile({
      path: '/src/fts-test.ts',
      filename: 'fts-test.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'ftsHash',
      language: 'typescript',
      is_binary: false,
      content: 'uniqueSearchTerm12345',
    });

    // Verify it's in FTS
    let results = db.searchFts('uniqueSearchTerm12345', 10);
    expect(results.length).toBe(1);

    // Delete
    db.deleteFile('/src/fts-test.ts');

    // Verify it's removed from FTS
    results = db.searchFts('uniqueSearchTerm12345', 10);
    expect(results.length).toBe(0);
  });
});

  describe('deleteAllFiles', () => {
    it('deletes all files', () => {
    db.upsertFiles([
      {
        path: '/a.ts',
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
      },
      {
        path: '/b.ts',
        filename: 'b.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h2',
        language: 'typescript',
        is_binary: false,
      },
    ]);

    expect(db.getStats().totalFiles).toBe(2);

    const deleted = db.deleteAllFiles();
    expect(deleted).toBe(2);
    expect(db.getStats().totalFiles).toBe(0);
  });

  it('clears FTS index when deleting all', () => {
    db.upsertFiles([
      {
        path: '/src/search.ts',
        filename: 'search.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
        content: 'findMeKeyword',
      },
    ]);

    let results = db.searchFts('findMeKeyword', 10);
    expect(results.length).toBe(1);

    db.deleteAllFiles();

    results = db.searchFts('findMeKeyword', 10);
    expect(results.length).toBe(0);
  });
});

  describe('searchFts', () => {
    beforeEach(() => {
    db.upsertFiles([
      {
        path: '/src/utils.ts',
        filename: 'utils.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
        content: 'export function formatDate(date: Date): string { return date.toISOString(); }',
      },
      {
        path: '/src/parser.ts',
        filename: 'parser.ts',
        extension: 'ts',
        size_bytes: 200,
        mtime_ms: Date.now(),
        content_hash: 'h2',
        language: 'typescript',
        is_binary: false,
        content: 'export function parseJSON(text: string) { return JSON.parse(text); }',
      },
      {
        path: '/README.md',
        filename: 'README.md',
        extension: 'md',
        size_bytes: 300,
        mtime_ms: Date.now(),
        content_hash: 'h3',
        language: 'markdown',
        is_binary: false,
        content: '# DevDesk Engine\n\nA fast code search engine.',
      },
    ]);
  });

    it('finds files by content match using FTS5', () => {
    const results = db.searchFts('formatDate', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path.includes('utils.ts'))).toBe(true);
  });

  it('finds files by partial word match', () => {
    const results = db.searchFts('parseJSON', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path.includes('parser.ts'))).toBe(true);
  });

  it('respects limit parameter', () => {
    // Add more files with "export"
    for (let i = 0; i < 5; i++) {
      db.upsertFile({
        path: `/src/export${i}.ts`,
        filename: `export${i}.ts`,
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: `hash${i}`,
        language: 'typescript',
        is_binary: false,
        content: `export const value${i} = ${i};`,
      });
    }

    const results = db.searchFts('export', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for no matches', () => {
    const results = db.searchFts('xyznonexistent123', 10);
    expect(results.length).toBe(0);
  });

  it('stays in sync after delete', () => {
    let results = db.searchFts('formatDate', 10);
    expect(results.length).toBeGreaterThan(0);

    db.deleteFile('/src/utils.ts');

    results = db.searchFts('formatDate', 10);
    expect(results.length).toBe(0);
  });
});

  describe('searchLike (fallback)', () => {
    beforeEach(() => {
    db.upsertFile({
      path: '/src/config.ts',
      filename: 'config.ts',
      extension: 'ts',
      size_bytes: 150,
      mtime_ms: Date.now(),
      content_hash: 'confighash',
      language: 'typescript',
      is_binary: false,
      content: 'export const API_KEY = "secret123";',
    });
  });

    it('finds files with LIKE pattern', () => {
    const results = db.searchLike('API_KEY', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain('config.ts');
    });

    it('respects limit parameter', () => {
    // Add more files
    for (let i = 0; i < 5; i++) {
      db.upsertFile({
        path: `/src/like${i}.ts`,
        filename: `like${i}.ts`,
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: `like${i}`,
        language: 'typescript',
        is_binary: false,
        content: 'export const test = "test";',
      });
    }

    const results = db.searchLike('test', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

  describe('searchRanked', () => {
    beforeEach(() => {
    const now = Date.now();
    const oldTime = now - 60 * 24 * 60 * 60 * 1000; // 60 days ago

    db.upsertFiles([
      {
        path: '/src/recent.ts',
        filename: 'recent.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: now,
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
        content: 'export function searchRanked() { return true; }',
      },
      {
        path: '/src/old.ts',
        filename: 'old.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: oldTime,
        content_hash: 'h2',
        language: 'typescript',
        is_binary: false,
        content: 'export function searchRanked() { return false; }',
      },
      {
        path: '/config.json',
        filename: 'config.json',
        extension: 'json',
        size_bytes: 50,
        mtime_ms: now,
        content_hash: 'h3',
        language: 'json',
        is_binary: false,
        content: '{ "searchRanked": true }',
      },
    ]);
  });

    it('returns results with scores', () => {
    const results = db.searchRanked('searchRanked', { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('score');
    expect(typeof results[0].score).toBe('number');
  });

  it('returns results sorted by score descending', () => {
    const results = db.searchRanked('searchRanked', { limit: 10 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('boosts recent files when enabled', () => {
    const results = db.searchRanked('searchRanked', { limit: 10, boostRecent: true });
    const recentFile = results.find((r) => r.path.includes('recent.ts'));
    const oldFile = results.find((r) => r.path.includes('old.ts'));

    expect(recentFile).toBeDefined();
    expect(oldFile).toBeDefined();

    // Recent file should generally have higher or equal score
    if (recentFile && oldFile) {
      expect(recentFile.score).toBeGreaterThanOrEqual(oldFile.score);
    }
  });

  it('boosts preferred languages', () => {
    const results = db.searchRanked('searchRanked', {
      limit: 10,
      preferLanguages: ['typescript'],
    });

    // TypeScript files should be boosted
    const tsFiles = results.filter((r) => r.language === 'typescript');
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('respects limit parameter', () => {
    const results = db.searchRanked('searchRanked', { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns empty array for no matches', () => {
    const results = db.searchRanked('xyznonexistent123', { limit: 10 });
    expect(results.length).toBe(0);
  });
});

  describe('getHashMap', () => {
    it('returns hash-to-path mapping', () => {
    db.upsertFile({
      path: '/src/file1.ts',
      filename: 'file1.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'hash_abc',
      language: 'typescript',
      is_binary: false,
    });

    db.upsertFile({
      path: '/src/file2.ts',
      filename: 'file2.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'hash_def',
      language: 'typescript',
      is_binary: false,
    });

    const hashMap = db.getHashMap();
    expect(hashMap.size).toBe(2);
    expect(hashMap.get('hash_abc')).toBe('/src/file1.ts');
    expect(hashMap.get('hash_def')).toBe('/src/file2.ts');
  });

  it('excludes files without content_hash', () => {
    db.upsertFile({
      path: '/src/binary.exe',
      filename: 'binary.exe',
      extension: 'exe',
      size_bytes: 1000,
      mtime_ms: Date.now(),
      content_hash: null,
      language: null,
      is_binary: true,
    });

    const hashMap = db.getHashMap();
    expect(hashMap.size).toBe(0);
  });
});

  describe('getAllPaths', () => {
    it('returns all file paths as a Set', () => {
    db.upsertFiles([
      {
        path: '/a.ts',
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
      },
      {
        path: '/b.ts',
        filename: 'b.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'h2',
        language: 'typescript',
        is_binary: false,
      },
    ]);

    const paths = db.getAllPaths();
    expect(paths.size).toBe(2);
    expect(paths.has('/a.ts')).toBe(true);
    expect(paths.has('/b.ts')).toBe(true);
  });

  it('returns empty Set for empty database', () => {
    const paths = db.getAllPaths();
    expect(paths.size).toBe(0);
  });
});

  describe('getPathsOlderThan', () => {
    it('returns paths older than given mtime', () => {
    const oldTime = Date.now() - 10000;
    const newTime = Date.now();

    db.upsertFile({
      path: '/src/old.ts',
      filename: 'old.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: oldTime,
      content_hash: 'old',
      language: 'typescript',
      is_binary: false,
    });

    db.upsertFile({
      path: '/src/new.ts',
      filename: 'new.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: newTime,
      content_hash: 'new',
      language: 'typescript',
      is_binary: false,
    });

    const oldPaths = db.getPathsOlderThan(newTime - 5000);
    expect(oldPaths).toContain('/src/old.ts');
    expect(oldPaths).not.toContain('/src/new.ts');
  });
});

  describe('getStats', () => {
    it('returns correct statistics', () => {
    db.upsertFiles([
      {
        path: '/src/app.ts',
        filename: 'app.ts',
        extension: 'ts',
        size_bytes: 500,
        mtime_ms: Date.now(),
        content_hash: 'h1',
        language: 'typescript',
        is_binary: false,
      },
      {
        path: '/src/lib.rs',
        filename: 'lib.rs',
        extension: 'rs',
        size_bytes: 1000,
        mtime_ms: Date.now(),
        content_hash: 'h2',
        language: 'rust',
        is_binary: false,
      },
      {
        path: '/src/utils.ts',
        filename: 'utils.ts',
        extension: 'ts',
        size_bytes: 300,
        mtime_ms: Date.now(),
        content_hash: 'h3',
        language: 'typescript',
        is_binary: false,
      },
    ]);

    const stats = db.getStats();

    expect(stats.totalFiles).toBe(3);
    expect(stats.totalSizeBytes).toBe(1800);
    expect(stats.byLanguage['typescript']).toBe(2);
    expect(stats.byLanguage['rust']).toBe(1);
    expect(stats.indexedAt).toBeDefined();
  });

  it('returns zero stats for empty database', () => {
    const stats = db.getStats();
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
    expect(Object.keys(stats.byLanguage).length).toBe(0);
  });
});

  describe('close', () => {
    it('closes database connection gracefully', () => {
    db.upsertFile({
      path: '/test.ts',
      filename: 'test.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'test',
      language: 'typescript',
      is_binary: false,
    });

    expect(() => db.close()).not.toThrow();
  });
});

  describe('optimize', () => {
    it('runs optimize pragma without error', () => {
    db.upsertFile({
      path: '/test.ts',
      filename: 'test.ts',
      extension: 'ts',
      size_bytes: 100,
      mtime_ms: Date.now(),
      content_hash: 'test',
      language: 'typescript',
      is_binary: false,
    });

    expect(() => db.optimize()).not.toThrow();
  });
});
});
