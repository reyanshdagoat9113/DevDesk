import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getStats, indexRepository, searchIndex } from './index.js';
import { DatabaseManager } from './db/index.js';
import type {
  FileInfo,
  IndexResult,
  SearchResult,
  FileSearchResult,
  SearchMatch,
  RustMatchInfo,
  RustFileResult,
  StatsResult,
  ErrorOutput,
  IndexOptions,
  SearchOptions,
} from './types.js';
import { normalizePath, getDefaultDbPath, resolvePath } from './utils.js';

/**
 * Tests for index.ts
 *
 * NOTE: indexRepository, searchIndex, runScanner, and runRegexSearch require
 * the Rust binary (devdesk-scan) to be built and available. These tests
 * are marked as Rust-dependent and should be run separately after building the Rust binary.
 *
 * To run all tests including Rust-dependent ones:
 *   npm run build:rust && npm test
 *
 * To run only unit tests (excluding Rust-dependent tests):
 *   npm test -- --exclude=rust
 */

describe('index.ts', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-index-test-'));
    dbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Types', () => {
    it('FileInfo interface has correct structure', () => {
    const fileInfo: FileInfo = {
    path: '/src/test.ts',
    filename: 'test.ts',
    extension: 'ts',
    size_bytes: 100,
    mtime_ms: Date.now(),
    content_hash: 'abc123',
    is_binary: false,
    content: 'const x = 1;',
  };
  expect(fileInfo.path).toBe('/src/test.ts');
  expect(fileInfo.filename).toBe('test.ts');
  expect(fileInfo.extension).toBe('ts');
  expect(fileInfo.is_binary).toBe(false);
  });

    it('IndexResult interface has correct structure', () => {
    const result: IndexResult = {
    ok: true,
    repo: '/project',
    db: '/path/to/db.sqlite',
    filesIndexed: 10,
    filesSkipped: 2,
    durationMs: 500,
    warnings: ['Test warning'],
  };
  expect(result.ok).toBe(true);
  expect(result.filesIndexed).toBe(10);
  expect(result.warnings).toHaveLength(1);
  });

    it('SearchResult interface has correct structure', () => {
    const match: SearchMatch = {
    line: 10,
    column: 5,
    snippet: 'const x = 1;',
    contextBefore: ['line 8', 'line 9'],
    contextAfter: ['line 11'],
  };
    const fileResult: FileSearchResult = {
    path: '/src/test.ts',
    language: 'typescript',
    score: 0.95,
    matches: [match],
  };
    const result: SearchResult = {
    ok: true,
    query: 'test query',
    results: [fileResult],
    totalMatches: 1,
    durationMs: 50,
  };
  expect(result.ok).toBe(true);
  expect(result.results).toHaveLength(1);
  expect(result.results[0].matches).toHaveLength(1);
  });

    it('StatsResult interface has correct structure', () => {
    const stats: StatsResult = {
    ok: true,
    db: '/path/to/db.sqlite',
    stats: {
    totalFiles: 100,
    totalSizeBytes: 50000,
    byLanguage: { typescript: 50, javascript: 30, rust: 20 },
    indexedAt: '2024-01-01T00:00:00.000Z',
  },
  };
  expect(stats.ok).toBe(true);
  expect(stats.stats.totalFiles).toBe(100);
  expect(stats.stats.byLanguage.typescript).toBe(50);
  });
  });

  describe('getStats', () => {
    it('returns stats for an indexed database', () => {
    // Create a database with some files
    const db = new DatabaseManager(dbPath);
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
      content: 'export function app() {}',
      },
      {
      path: '/src/lib.rs',
      filename: 'lib.rs',
      extension: 'rs',
      size_bytes: 300,
        mtime_ms: Date.now(),
      content_hash: 'h2',
      language: 'rust',
      is_binary: false,
      content: 'pub fn lib() {}',
      },
    ]);
    db.close();

    const result = getStats(dbPath);

    expect(result.ok).toBe(true);
    expect(result.db).toBe(normalizePath(dbPath));
    expect(result.stats.totalFiles).toBe(2);
    expect(result.stats.byLanguage.typescript).toBe(1);
    expect(result.stats.byLanguage.rust).toBe(1);
    expect(result.stats.totalSizeBytes).toBe(800);
  });

  it('returns stats with zero files for empty database', () => {
    const db = new DatabaseManager(dbPath);
    db.close();

    const result = getStats(dbPath);

    expect(result.ok).toBe(true);
    expect(result.stats.totalFiles).toBe(0);
    expect(result.stats.totalSizeBytes).toBe(0);
  });

  it('normalizes path in result', () => {
    const result = getStats(dbPath);
    expect(result.db).toBe(normalizePath(dbPath));
  });
  });

  describe('Error Handling', () => {
    it('handles non-existent database path gracefully', () => {
    // getStats creates the database if it doesn't exist
    const nonExistentPath = path.join(tempDir, 'nonexistent', 'db.sqlite');
    const result = getStats(nonExistentPath);

    expect(result.ok).toBe(true);
    expect(result.stats.totalFiles).toBe(0);
  });
  });

  describe('Utility Integration', () => {
    it('getDefaultDbPath creates consistent paths', () => {
    const repoPath = '/home/user/myproject';
    const dbPath = getDefaultDbPath(repoPath);

    expect(dbPath).toContain('.devdesk');
    expect(dbPath).toContain('index');
    expect(dbPath).toMatch(/myproject\.sqlite$/);
  });

  it('normalizePath handles Windows paths', () => {
    const winPath = 'C:\\Users\\project';
    const normalized = normalizePath(winPath);
    expect(normalized).toBe('C:/Users/project');
  });

  it('resolvePath handles relative paths', () => {
    const relativePath = 'src/file.ts';
    const resolved = resolvePath(relativePath, '/project');
    expect(resolved).toBe(path.resolve('/project', 'src/file.ts'));
  });
});

describe('Rust-dependent integration', () => {
  it('indexes a repository and stores canonical paths', async () => {
    const repoPath = path.join(tempDir, 'index-repo');
    fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'src', 'test.ts'), 'export const answer = 42;\n');

    const result = await indexRepository({
      repo: repoPath,
      db: dbPath,
      incremental: false,
    });

    expect(result.ok).toBe(true);
    expect(result.repo).toBe(normalizePath(repoPath));
    expect(result.db).toBe(normalizePath(dbPath));
    expect(result.filesIndexed).toBeGreaterThan(0);

    const db = new DatabaseManager(dbPath);
    const stored = db.getFileByPath(path.join(repoPath, 'src', 'test.ts'));
    db.close();

    expect(stored?.path).toBe(normalizePath(path.join(repoPath, 'src', 'test.ts')));
  });

  it('returns normalized paths for regex search results', async () => {
    const repoPath = path.join(tempDir, 'search-repo');
    fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'src', 'search.ts'), 'export function searchTest() {\n  return "needle";\n}\n');

    await indexRepository({
      repo: repoPath,
      db: dbPath,
      incremental: false,
    });

    const result = await searchIndex({
      db: dbPath,
      query: 'needle',
      regex: true,
      limit: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.results[0].path).toBe(normalizePath(path.join(repoPath, 'src', 'search.ts')));
  });

  it('boosts ranking when hotspot data is present', async () => {
    const repoPath = path.join(tempDir, 'hotspot-repo');
    fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoPath, 'src', 'a.ts'), 'export const shared = 1;\n');
    fs.writeFileSync(path.join(repoPath, 'src', 'b.ts'), 'export const shared = 1;\n');

    const db = new DatabaseManager(dbPath);
    db.upsertRepository({
      path: repoPath,
      isGit: true,
      branch: 'main',
      totalCommits: 10,
      contributors: ['DevDesk <devdesk@example.com>'],
      lastIndexedAt: Date.now(),
    });
    db.upsertFiles([
      {
        path: path.join(repoPath, 'src', 'a.ts'),
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 10,
        mtime_ms: Date.now(),
        content_hash: 'a',
        language: 'typescript',
        is_binary: false,
        content: 'export const shared = 1;\n',
      },
      {
        path: path.join(repoPath, 'src', 'b.ts'),
        filename: 'b.ts',
        extension: 'ts',
        size_bytes: 10,
        mtime_ms: Date.now(),
        content_hash: 'b',
        language: 'typescript',
        is_binary: false,
        content: 'export const shared = 1;\n',
      },
    ]);
    db.replaceGitHotspots(repoPath, [
      {
        path: path.join(repoPath, 'src', 'b.ts'),
        score: 95,
        commits: 8,
        recency: 1,
        risk: 'high',
      },
    ]);
    db.close();

    const result = await searchIndex({
      db: dbPath,
      query: 'shared',
      regex: false,
      limit: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.results[0].path).toBe(normalizePath(path.join(repoPath, 'src', 'b.ts')));
  });
});
});
