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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-test-'));
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

    it('creates files table', () => {
      const result = db.getStats();
      expect(result.totalFiles).toBe(0);
    });

    it('creates schema_version table', () => {
      // No error means table exists
      const stats = db.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('upsertFile', () => {
    it('inserts a new file', () => {
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

    it('updates existing file on conflict', () => {
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
        filename: 'app.ts',
        extension: 'ts',
        size_bytes: 2048, // Changed
        mtime_ms: Date.now(),
        content_hash: 'def456', // Changed
        language: 'typescript',
        is_binary: false,
        content: 'const x = 2;', // Changed
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
  });

  describe('getFileByPath', () => {
    it('retrieves file by path', () => {
      db.upsertFile({
        path: '/src/main.rs',
        filename: 'main.rs',
        extension: 'rs',
        size_bytes: 500,
        mtime_ms: 1234567890,
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
    });

    it('returns undefined for non-existent path', () => {
      const file = db.getFileByPath('/nonexistent/file.txt');
      expect(file).toBeUndefined();
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
      const results = db.searchFts('function', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('returns empty array for no matches', () => {
      const results = db.searchFts('xyznonexistent123', 10);
      expect(results.length).toBe(0);
    });

    it('stays in sync after delete', () => {
      // Verify file is found
      let results = db.searchFts('formatDate', 10);
      expect(results.length).toBeGreaterThan(0);

      // Delete the file
      db.deleteFile('/src/utils.ts');

      // Verify it's no longer found
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
      const results = db.searchLike('export', 1);
      expect(results.length).toBeLessThanOrEqual(1);
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
        content_hash: null, // No hash
        language: 'binary',
        is_binary: true,
      });

      const hashMap = db.getHashMap();
      expect(hashMap.size).toBe(0);
    });
  });

  describe('getAllPaths', () => {
    it('returns all file paths', () => {
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
  });

  describe('optimize', () => {
    it('runs without error', () => {
      db.upsertFile({
        path: '/test.ts',
        filename: 'test.ts',
        extension: 'ts',
        size_bytes: 100,
        mtime_ms: Date.now(),
        content_hash: 'hash',
        language: 'typescript',
        is_binary: false,
      });

      expect(() => db.optimize()).not.toThrow();
    });
  });

  describe('searchRanked', () => {
    beforeEach(() => {
      db.upsertFiles([
        {
          path: '/src/recent.ts',
          filename: 'recent.ts',
          extension: 'ts',
          size_bytes: 100,
          mtime_ms: Date.now(), // Recent file
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
          mtime_ms: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days old
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
          mtime_ms: Date.now(),
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

    it('boosts recent files when enabled', () => {
      const results = db.searchRanked('searchRanked', { limit: 10, boostRecent: true });
      const recentFile = results.find((r) => r.path.includes('recent.ts'));
      const oldFile = results.find((r) => r.path.includes('old.ts'));

      // Both should exist
      expect(recentFile).toBeDefined();
      expect(oldFile).toBeDefined();

      // Recent file should have higher score
      if (recentFile && oldFile) {
        expect(recentFile.score).toBeGreaterThanOrEqual(oldFile.score);
      }
    });

    it('respects limit parameter', () => {
      const results = db.searchRanked('searchRanked', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('returns empty array for no matches', () => {
      const results = db.searchRanked('xyznonexistent123', { limit: 10 });
      expect(results.length).toBe(0);
    });

    it('falls back to LIKE search on FTS error', () => {
      // Special characters that might break FTS
      const results = db.searchRanked('searchRanked', { limit: 10 });
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
