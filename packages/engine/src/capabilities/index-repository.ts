import * as fs from 'fs';
import * as path from 'path';
import type { IndexOptions, IndexResult } from '../types.js';
import { DatabaseManager } from '../db/index.js';
import { getDefaultDbPath, normalizePath, resolvePath } from '../utils.js';
import { detectLanguage, shouldIndex } from '../lang.js';
import { getGitInsights, isGitRepo, resolveHotspots } from '../git.js';
import type { RustWorkerClient } from '../workers/client.js';

export interface CapabilityDeps {
  worker: RustWorkerClient;
}

export async function indexRepositoryCapability(
  deps: CapabilityDeps,
  options: IndexOptions
): Promise<IndexResult> {
  const { repo, incremental = false } = options;
  const repoPath = resolvePath(repo);
  const dbPath = resolvePath(options.db || getDefaultDbPath(repoPath));
  const startedAt = Date.now();

  if (!fs.existsSync(repoPath)) {
    return {
      ok: false,
      repo: normalizePath(repoPath),
      db: normalizePath(dbPath),
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: Date.now() - startedAt,
      warnings: [`Repository path does not exist: ${repoPath}`],
    };
  }

  const db = new DatabaseManager(dbPath);
  const warnings: string[] = [];

  try {
    const existingHashMap = incremental ? db.getHashMap() : new Map<string, string>();
    const existingPaths = incremental ? db.getAllPaths() : new Set<string>();

    if (!incremental) {
      db.deleteAllFiles();
      db.clearGitHotspots(repoPath);
    }

    const files = await deps.worker.scanRepository(repoPath, true);
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

    for (const file of files) {
      const canonicalPath = normalizePath(file.path);

      if (file.is_binary) {
        skipped++;
        continue;
      }

      if (incremental && file.content_hash && existingHashMap.has(file.content_hash)) {
        existingPaths.delete(canonicalPath);
        continue;
      }

      const language = detectLanguage(file.filename, file.extension);
      if (!shouldIndex(language)) {
        skipped++;
        continue;
      }

      toIndex.push({
        path: canonicalPath,
        filename: file.filename,
        extension: file.extension,
        size_bytes: file.size_bytes,
        mtime_ms: file.mtime_ms,
        content_hash: file.content_hash,
        language: language === 'unknown' ? null : language,
        is_binary: false,
        content: file.content,
      });
    }

    if (incremental) {
      for (const oldPath of existingPaths) {
        db.deleteFile(oldPath);
      }
    }

    const indexed = db.upsertFiles(toIndex);
    const indexedAt = Date.now();
    const gitRepo = isGitRepo(repoPath);

    if (gitRepo) {
      try {
        const gitInsights = getGitInsights(repoPath, { limit: 20 });
        db.upsertRepository({
          path: repoPath,
          isGit: true,
          branch: gitInsights.branch,
          totalCommits: gitInsights.totalCommits,
          contributors: gitInsights.contributors,
          lastIndexedAt: indexedAt,
        });

        const hotspots = resolveHotspots(repoPath, gitInsights.hotspots).map((hotspot) => ({
          path: hotspot.path,
          score: hotspot.score,
          commits: hotspot.commits,
          recency: hotspot.recency,
          risk: hotspot.risk,
        }));

        db.replaceGitHotspots(repoPath, hotspots);
      } catch (error) {
        warnings.push(`Git metadata unavailable: ${error instanceof Error ? error.message : String(error)}`);
        db.upsertRepository({
          path: repoPath,
          isGit: true,
          lastIndexedAt: indexedAt,
        });
        db.clearGitHotspots(repoPath);
      }
    } else {
      db.upsertRepository({
        path: repoPath,
        isGit: false,
        lastIndexedAt: indexedAt,
      });
      db.clearGitHotspots(repoPath);
    }

    db.optimize();

    if (skipped > 0) {
      warnings.push(`Skipped ${skipped} binary or unsupported files`);
    }

    return {
      ok: true,
      repo: normalizePath(repoPath),
      db: normalizePath(dbPath),
      filesIndexed: indexed,
      filesSkipped: skipped,
      durationMs: Date.now() - startedAt,
      warnings,
    };
  } finally {
    db.close();
  }
}
