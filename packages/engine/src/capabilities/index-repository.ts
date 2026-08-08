import * as fs from 'fs';
import type { IndexOptions, IndexResult } from '../types.js';
import { DatabaseManager } from '../db/index.js';
import { getDefaultDbPath, normalizePath, resolvePath } from '../utils.js';
import { detectLanguage, shouldIndex } from '../lang.js';
import { getGitInsights, isGitRepo, resolveHotspots } from '../git.js';
import {
  createIndexPolicy,
  createPathMatcher,
  emptySkipReasons,
  formatSkipReasons,
  loadDevdeskIgnorePatterns,
} from '../index-policy.js';
import type { RustWorkerClient } from '../workers/client.js';

export interface CapabilityDeps {
  worker: RustWorkerClient;
}

function toRepoRelative(repoPath: string, absolutePath: string): string {
  const repo = normalizePath(repoPath).toLowerCase();
  const file = normalizePath(absolutePath);
  const fileLower = file.toLowerCase();
  if (fileLower.startsWith(repo + '/')) {
    return file.slice(normalizePath(repoPath).length + 1);
  }
  return file;
}

export async function indexRepositoryCapability(
  deps: CapabilityDeps,
  options: IndexOptions
): Promise<IndexResult> {
  const { repo, incremental = false } = options;
  const repoPath = resolvePath(repo);
  const dbPath = resolvePath(options.db || getDefaultDbPath(repoPath));
  const startedAt = Date.now();
  const policy = createIndexPolicy(repoPath, options.profile);
  const userIgnoreMatcher = createPathMatcher(loadDevdeskIgnorePatterns(repoPath));

  if (!fs.existsSync(repoPath)) {
    return {
      ok: false,
      repo: normalizePath(repoPath),
      db: normalizePath(dbPath),
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: Date.now() - startedAt,
      warnings: [`Repository path does not exist: ${repoPath}`],
      profile: policy.profile,
    };
  }

  const db = new DatabaseManager(dbPath);
  const warnings: string[] = [];
  const skipReasons = emptySkipReasons();

  try {
    const existingPathHashMap = incremental ? db.getPathHashMap() : new Map<string, string | null>();
    const existingPaths = incremental ? new Set(existingPathHashMap.keys()) : new Set<string>();

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
        skipReasons.binary++;
        // Leave in existingPaths so a previously indexed path that became binary is removed.
        continue;
      }

      // Path policy (.devdeskignore + profile globs) — leave in existingPaths so
      // incremental reindex drops paths that are newly out of scope.
      if (policy.ignoresPath(canonicalPath, repoPath)) {
        skipped++;
        const rel = toRepoRelative(repoPath, canonicalPath);
        if (userIgnoreMatcher.ignores(rel)) {
          skipReasons.devdeskignore++;
        } else {
          skipReasons.profile++;
        }
        continue;
      }

      const language = detectLanguage(file.filename, file.extension);
      if (!shouldIndex(language)) {
        skipped++;
        skipReasons.language++;
        continue;
      }

      if (policy.ignoresLanguage(language)) {
        skipped++;
        skipReasons.profile++;
        continue;
      }

      // Path-primary identity: skip only when this path still exists with the same content hash.
      // Renames and duplicate-content copies must still be indexed.
      if (incremental) {
        existingPaths.delete(canonicalPath);
        const previousHash = existingPathHashMap.get(canonicalPath);
        if (
          previousHash != null &&
          file.content_hash != null &&
          previousHash === file.content_hash
        ) {
          skipReasons.unchanged++;
          continue;
        }
      } else {
        existingPaths.delete(canonicalPath);
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
    if (!incremental) {
      // Full/profile-changing rebuilds should reclaim pages from the previous
      // index so the reported physical size reflects the new scope.
      db.compact();
    } else {
      db.checkpoint();
    }

    if (skipped > 0) {
      const excludedReasons = { ...skipReasons, unchanged: 0 };
      warnings.push(
        `Excluded ${skipped} files (${formatSkipReasons(excludedReasons)}); profile=${policy.profile}`,
      );
    }

    const stats = db.getStats();
    let physicalDbBytes = 0;
    try {
      physicalDbBytes = fs.statSync(dbPath).size;
    } catch {
      physicalDbBytes = 0;
    }

    return {
      ok: true,
      repo: normalizePath(repoPath),
      db: normalizePath(dbPath),
      filesIndexed: indexed,
      filesSkipped: skipped,
      durationMs: Date.now() - startedAt,
      warnings,
      profile: policy.profile,
      skipReasons,
      metrics: {
        logicalIndexedBytes: stats.totalSizeBytes,
        searchableContentBytes: stats.searchableContentBytes,
        physicalDbBytes,
      },
    };
  } finally {
    db.close();
  }
}
