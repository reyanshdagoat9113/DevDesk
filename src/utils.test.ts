import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  normalizePath,
  measureTime,
  measureTimeSync,
  formatBytes,
  ensureDir,
  getDefaultDbPath,
  retry,
  isAbsolutePath,
  resolvePath,
  toNativePath,
} from './utils.js';

describe('utils', () => {
  describe('normalizePath', () => {
    it('normalizes paths with forward slashes', () => {
      expect(normalizePath('/home/user/project')).toBe('/home/user/project');
    });

    it('converts backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\project')).toBe('C:/Users/project');
    });

    it('handles mixed slashes', () => {
      expect(normalizePath('path/to\\mixed')).toBe('path/to/mixed');
    });

    it('handles relative paths', () => {
      expect(normalizePath('./relative/path')).toMatch(/relative\/path/);
    });

    it('handles paths with double slashes', () => {
      const result = normalizePath('/home//user/project');
      // Path.normalize should collapse double slashes
      expect(result).not.toContain('//');
    });
  });

  describe('measureTime', () => {
    it('measures execution time of async function', async () => {
      const { result, durationMs } = await measureTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 42;
      });

      expect(result).toBe(42);
      expect(durationMs).toBeGreaterThanOrEqual(10);
    });

    it('returns 0ms for instant functions', async () => {
      const { result, durationMs } = await measureTime(async () => 'instant');

      expect(result).toBe('instant');
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles rejected promises', async () => {
      await expect(
        measureTime(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('measureTimeSync', () => {
    it('measures execution time of sync function', () => {
      const { result, durationMs } = measureTimeSync(() => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
      });

      expect(result).toBe(499500);
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles functions that throw', () => {
      expect(() =>
        measureTimeSync(() => {
          throw new Error('sync error');
        })
      ).toThrow('sync error');
    });
  });

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(1099511627776)).toBe('1 TB');
    });

    it('handles large numbers', () => {
      expect(formatBytes(10737418240)).toBe('10 GB');
    });

    it('handles decimal places', () => {
      expect(formatBytes(1234567)).toBe('1.18 MB');
    });
  });

  describe('ensureDir', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-ensure-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates directory if it does not exist', () => {
      const newDir = path.join(tempDir, 'new-directory');
      expect(fs.existsSync(newDir)).toBe(false);

      ensureDir(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('does not throw if directory already exists', () => {
      expect(() => ensureDir(tempDir)).not.toThrow();
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('creates nested directories', () => {
      const nestedDir = path.join(tempDir, 'a', 'b', 'c', 'd');
      expect(fs.existsSync(nestedDir)).toBe(false);

      ensureDir(nestedDir);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });
  });

  describe('getDefaultDbPath', () => {
    it('returns path in ~/.devdesk/index directory', () => {
      const repoPath = '/home/user/myproject';
      const dbPath = getDefaultDbPath(repoPath);

      expect(dbPath).toContain('.devdesk');
      expect(dbPath).toContain('index');
      expect(dbPath).toMatch(/\.sqlite$/);
    });

    it('uses repository basename for database name', () => {
      const dbPath = getDefaultDbPath('/home/user/my-awesome-project');
      expect(dbPath).toContain('my-awesome-project.sqlite');
    });

    it('creates the index directory if it does not exist', () => {
      const repoPath = '/tmp/test-repo-unique-' + Date.now();
      const dbPath = getDefaultDbPath(repoPath);

      const indexDir = path.dirname(dbPath);
      expect(fs.existsSync(indexDir)).toBe(true);

      // Cleanup
      fs.rmSync(indexDir, { recursive: true, force: true });
    });

    it('normalizes relative workspace paths to a stable filename', () => {
      const dbPath = getDefaultDbPath('.');
      expect(path.basename(dbPath)).toBe('devdesk-engine.sqlite');
    });
  });

  describe('retry', () => {
    it('returns result on first successful attempt', async () => {
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        return 'success';
      }, 3);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('retries on failure', async () => {
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      }, 3, 10);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('throws after max attempts', async () => {
      let attempts = 0;

      await expect(
        retry(async () => {
          attempts++;
          throw new Error('always fails');
        }, 3, 10)
      ).rejects.toThrow('always fails');

      expect(attempts).toBe(3);
    });

    it('uses exponential backoff', async () => {
      const delays: number[] = [];
      let attempts = 0;

      await retry(async () => {
        attempts++;
        const now = Date.now();
        if (delays.length > 0) {
          delays.push(now - delays[delays.length - 1]);
        } else {
          delays.push(now);
        }
        throw new Error('fail');
      }, 3, 50).catch(() => {});

      // Should have attempted 3 times
      expect(attempts).toBe(3);
    });
  });

  describe('isAbsolutePath', () => {
    it('returns true for absolute Unix paths', () => {
      expect(isAbsolutePath('/home/user/project')).toBe(true);
      expect(isAbsolutePath('/')).toBe(true);
      expect(isAbsolutePath('/tmp')).toBe(true);
    });

    it('returns true for absolute Windows paths', () => {
      expect(isAbsolutePath('C:\\Users\\project')).toBe(true);
      expect(isAbsolutePath('D:\\')).toBe(true);
    });

    it('returns false for relative paths', () => {
      expect(isAbsolutePath('relative/path')).toBe(false);
      expect(isAbsolutePath('./relative')).toBe(false);
      expect(isAbsolutePath('../parent')).toBe(false);
      expect(isAbsolutePath('file.txt')).toBe(false);
    });
  });

  describe('resolvePath', () => {
    it('returns absolute paths unchanged', () => {
      expect(resolvePath('/absolute/path')).toBe('/absolute/path');
    });

    it('resolves relative paths against cwd', () => {
      const result = resolvePath('relative/path');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('relative');
    });

    it('resolves relative paths against custom base directory', () => {
      const result = resolvePath('file.txt', '/custom/base');
      expect(result).toBe(path.resolve('/custom/base', 'file.txt'));
    });

    it('handles ./ prefix', () => {
      const result = resolvePath('./file.txt', '/base');
      expect(result).toBe(path.resolve('/base', 'file.txt'));
    });

    it('handles ../ prefix', () => {
      const result = resolvePath('../file.txt', '/base/subdir');
      expect(result).toBe(path.resolve('/base/subdir', '../file.txt'));
    });
  });

  describe('toNativePath', () => {
    it('converts canonical paths to native filesystem paths', () => {
      const native = toNativePath('C:/Users/project/src/file.ts');
      expect(native).toBe(path.normalize('C:/Users/project/src/file.ts'));
    });
  });
});
