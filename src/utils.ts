import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalize path for cross-platform compatibility
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

/**
 * Get the path to the Rust scanner binary
 */
export function getScannerBinaryPath(): string {
  const binaryName = os.platform() === 'win32' ? 'devdesk-scan.exe' : 'devdesk-scan';

  // Check multiple locations
  const possiblePaths = [
    // Development: in dist folder
    path.join(__dirname, binaryName),
    // Installed: alongside this file
    path.join(__dirname, binaryName),
    // In PATH
    binaryName,
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Return default, let it fail with clear error
  return path.join(__dirname, binaryName);
}

/**
 * Measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Measure execution time (sync)
 */
export function measureTimeSync<T>(fn: () => T): { result: T; durationMs: number } {
  const start = Date.now();
  const result = fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get default database path for a repository
 */
export function getDefaultDbPath(repoPath: string): string {
  const resolvedRepoPath = resolvePath(repoPath);
  const rawRepoName = path.basename(resolvedRepoPath);
  const repoName = sanitizeDbName(rawRepoName);
  const homeDir = os.homedir();
  const indexDir = path.join(homeDir, '.devdesk', 'index');

  ensureDir(indexDir);

  return path.join(indexDir, `${repoName}.sqlite`);
}

function sanitizeDbName(repoName: string): string {
  const trimmed = repoName.trim();
  if (!trimmed || trimmed === '.' || trimmed === path.sep) {
    return 'workspace';
  }

  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'workspace';
  }

  return sanitized;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p) || /^[a-zA-Z]:[\\/]/.test(p);
}

/**
 * Resolve path (handles relative and absolute)
 */
export function resolvePath(p: string, baseDir?: string): string {
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.resolve(baseDir || process.cwd(), p);
}
