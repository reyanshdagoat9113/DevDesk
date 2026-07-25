import { spawn } from 'child_process';
import * as fs from 'fs';
import type { FileInfo, RustFileResult } from '../types.js';
import { getScannerBinaryPath, resolvePath, toNativePath } from '../utils.js';

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

    return new Promise((resolve, reject) => {
      const proc = spawn(scannerPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const files: FileInfo[] = [];
      let stderr = '';
      let stdoutBuffer = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          try {
            files.push(JSON.parse(line) as FileInfo);
          } catch {
            // Skip invalid JSON.
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Scanner failed (${code}): ${stderr}`));
          return;
        }

        if (stdoutBuffer.trim()) {
          try {
            files.push(JSON.parse(stdoutBuffer) as FileInfo);
          } catch {
            // Ignore incomplete trailing output.
          }
        }

        resolve(files);
      });

      proc.on('error', reject);
    });
  }

  searchRegex(pattern: string, filePaths: string[]): Promise<RustFileResult[]> {
    const scannerPath = getScannerBinaryPath();

    if (!fs.existsSync(scannerPath)) {
      throw new Error(`Scanner binary not found: ${scannerPath}. Run 'npm run build:rust' first.`);
    }

    if (filePaths.length === 0) {
      return Promise.resolve([]);
    }

    const nativePaths = filePaths.map((filePath) => toNativePath(filePath));

    return new Promise((resolve, reject) => {
      const args = ['search', '--pattern', pattern, '--files', nativePaths.join(',')];

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
          resolve(JSON.parse(stdout) as RustFileResult[]);
        } catch {
          resolve([]);
        }
      });

      proc.on('error', reject);
    });
  }
}
