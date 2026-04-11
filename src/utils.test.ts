import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ensureDir,
  formatBytes,
  getDefaultDbPath,
  isAbsolutePath,
  measureTime,
  measureTimeSync,
  normalizePath,
  resolvePath,
  retry,
  toNativePath,
} from './utils.js';

describe('utils', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-utils-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('normalizes and denormalizes paths', () => {
    expect(normalizePath('C:\\Users\\dev\\project')).toBe('C:/Users/dev/project');
    expect(toNativePath('src/app.ts')).toBe(path.normalize(`src${path.sep}app.ts`));
  });

  it('measures async and sync execution time', async () => {
    const asyncResult = await measureTime(async () => 'ok');
    const syncResult = measureTimeSync(() => 42);

    expect(asyncResult.result).toBe('ok');
    expect(asyncResult.durationMs).toBeGreaterThanOrEqual(0);
    expect(syncResult.result).toBe(42);
    expect(syncResult.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('formats bytes at different units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('ensures directories and resolves default DB paths', () => {
    const nested = path.join(tempDir, 'a', 'b', 'c');
    ensureDir(nested);
    expect(fs.existsSync(nested)).toBe(true);

    const dbPath = getDefaultDbPath(path.join(tempDir, 'demo repo'));
    expect(dbPath).toContain(path.join('.devdesk', 'index'));
    expect(path.basename(dbPath)).toBe('demo_repo.sqlite');
  });

  it('retries failed work before succeeding', async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('not yet');
      }
      return 'done';
    }, 3, 1);

    expect(result).toBe('done');
    expect(attempts).toBe(3);
  });

  it('detects absolute paths and resolves relative paths', () => {
    expect(isAbsolutePath('/tmp/demo')).toBe(true);
    expect(isAbsolutePath('relative/demo')).toBe(false);
    expect(resolvePath('src/file.ts', '/workspace')).toBe(path.resolve('/workspace', 'src/file.ts'));
  });
});
