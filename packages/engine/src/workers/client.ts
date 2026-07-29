import { spawn } from 'child_process';
import * as fs from 'fs';
import type { FileInfo, RustFileResult } from '../types.js';
import { getScannerBinaryPath, resolvePath, toNativePath } from '../utils.js';

const DEFAULT_WORKER_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BYTES = 32 * 1024 * 1024;

// Windows caps a command line at ~32767 chars; POSIX is far larger but still bounded.
// Keep a conservative budget so the scanner invocation never fails on argv length.
const MAX_FILES_ARG_CHARS = process.platform === 'win32' ? 24_000 : 96_000;

/** Split paths so each `--files` argument stays under the platform argv budget. */
export function chunkPathsForArgv(
  paths: string[],
  maxChars: number = MAX_FILES_ARG_CHARS
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const filePath of paths) {
    const cost = filePath.length + 1;
    if (current.length > 0 && currentChars + cost > maxChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(filePath);
    currentChars += cost;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function runBoundedProcess(
  scannerPath: string,
  args: string[],
  options: { timeoutMs?: number; maxStdoutBytes?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes ?? MAX_STDOUT_BYTES;

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;

    const proc = spawn(scannerPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const kill = () => {
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      kill();
      settle(() => reject(new Error(`Worker timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    proc.stdout?.on('data', (data: Buffer) => {
      stdoutBytes += data.length;
      if (stdoutBytes > maxStdoutBytes) {
        kill();
        settle(() => reject(new Error(`Worker stdout exceeded ${maxStdoutBytes} bytes`)));
        return;
      }
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      settle(() => reject(error));
    });

    proc.on('close', (code) => {
      settle(() => resolve({ stdout, stderr, code }));
    });
  });
}

export class RustWorkerClient {
  scanRepository(repoPath: string, includeContent: boolean = false): Promise<FileInfo[]> {
    const scannerPath = getScannerBinaryPath();
    const nativeRepoPath = toNativePath(resolvePath(repoPath));

    if (!fs.existsSync(scannerPath)) {
      throw new Error(`Scanner binary not found: ${scannerPath}. Run 'npm run build:rust' first.`);
    }

    const args = ['scan', '--path', nativeRepoPath, '--hidden'];
    if (includeContent) {
      args.push('--content');
    }

    return runBoundedProcess(scannerPath, args).then(({ stdout, stderr, code }) => {
      if (code !== 0) {
        throw new Error(`Scanner failed (${code}): ${stderr}`);
      }

      const files: FileInfo[] = [];
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          files.push(JSON.parse(trimmed) as FileInfo);
        } catch {
          throw new Error(`Malformed scanner NDJSON line: ${trimmed.slice(0, 200)}`);
        }
      }
      return files;
    });
  }

  async searchRegex(pattern: string, filePaths: string[]): Promise<RustFileResult[]> {
    const scannerPath = getScannerBinaryPath();

    if (!fs.existsSync(scannerPath)) {
      throw new Error(`Scanner binary not found: ${scannerPath}. Run 'npm run build:rust' first.`);
    }

    if (filePaths.length === 0) {
      return [];
    }

    const nativePaths = filePaths.map((filePath) => toNativePath(filePath));
    const results: RustFileResult[] = [];

    // The path list travels through argv, so it must stay under the platform
    // command-line limit. Batch it instead of failing with E2BIG/ENAMETOOLONG.
    for (const batch of chunkPathsForArgv(nativePaths)) {
      const args = ['search', '--pattern', pattern, '--files', batch.join(',')];
      const { stdout, stderr, code } = await runBoundedProcess(scannerPath, args, {
        timeoutMs: 60_000,
      });

      if (code !== 0) {
        throw new Error(`Search failed (${code}): ${stderr || stdout}`);
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        continue;
      }

      let parsed: RustFileResult[];
      try {
        parsed = JSON.parse(trimmed) as RustFileResult[];
      } catch {
        throw new Error(`Malformed search JSON output: ${trimmed.slice(0, 200)}`);
      }

      results.push(...parsed);
    }

    return results;
  }
}
