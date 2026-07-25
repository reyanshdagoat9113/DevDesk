import * as path from 'path';
import { DatabaseManager } from '../db/index.js';
import type {
  FileSearchResult,
  SearchOptions,
  SearchResult,
  GitHotspotRecord,
} from '../types.js';
import { getGitInsights } from '../git.js';
import { normalizePath, resolvePath, toNativePath } from '../utils.js';
import type { RustWorkerClient } from '../workers/client.js';

export interface SearchCapabilityDeps {
  worker: RustWorkerClient;
}

function applyHotspotBoost(baseScore: number, hotspot?: GitHotspotRecord): number {
  if (!hotspot) {
    return baseScore;
  }

  const scoreBonus = Math.min(hotspot.score / 100, 0.15);
  const riskBonus = hotspot.risk === 'high' ? 0.05 : hotspot.risk === 'medium' ? 0.03 : 0.01;
  const boost = Math.min(scoreBonus + riskBonus, 0.2);

  return Math.round(baseScore * (1 + boost) * 1000) / 1000;
}

function getHotspotMap(db: DatabaseManager): Map<string, GitHotspotRecord> {
  const primaryRepo = db.getPrimaryRepository();
  if (!primaryRepo) {
    return new Map();
  }

  const hotspotMap = db.getGitHotspotMap(primaryRepo.path);
  if (hotspotMap.size > 0 || !primaryRepo.isGit) {
    return hotspotMap;
  }

  try {
    const liveInsights = getGitInsights(primaryRepo.path, { limit: 20 });
    return new Map(
      liveInsights.hotspots.map((hotspot) => {
        const absolutePath = normalizePath(path.resolve(primaryRepo.path, hotspot.path));
        return [
          absolutePath,
          {
            id: 0,
            repositoryPath: primaryRepo.path,
            path: absolutePath,
            score: hotspot.score,
            commits: hotspot.commits,
            recency: hotspot.recency,
            risk: hotspot.risk,
            updatedAt: Date.now(),
          },
        ] as const;
      })
    );
  } catch {
    return hotspotMap;
  }
}

export async function searchIndexCapability(
  deps: SearchCapabilityDeps,
  options: SearchOptions
): Promise<SearchResult> {
  const { db: dbInput, query, regex, limit = 100 } = options;
  const dbPath = resolvePath(dbInput);
  const db = new DatabaseManager(dbPath);
  const startedAt = Date.now();

  try {
    const rankedFiles = db.searchRanked(query, {
      limit: limit * 2,
      boostRecent: true,
    });

    const hotspotMap = getHotspotMap(db);
    const boostedFiles = rankedFiles
      .map((file) => ({
        ...file,
        score: applyHotspotBoost(file.score > 0 ? file.score : 0.1, hotspotMap.get(file.path)),
      }))
      .sort((a, b) => b.score - a.score);

    if (regex) {
      // Validate pattern in TypeScript before spawning the worker.
      try {
        // eslint-disable-next-line no-new
        new RegExp(query);
      } catch (error) {
        return {
          ok: false,
          query,
          results: [],
          totalMatches: 0,
          durationMs: Date.now() - startedAt,
          error: `Invalid regex: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      // Regex must not depend on FTS prefilter — search all indexed non-binary paths.
      const allPaths = [...db.getAllPaths()].map((filePath) => toNativePath(filePath));
      const rustResults = await deps.worker.searchRegex(query, allPaths);
      const fileMeta = new Map(boostedFiles.map((file) => [file.path, file]));

      const results: FileSearchResult[] = rustResults.slice(0, limit).map((result) => {
        const normalizedPath = normalizePath(result.path);
        const file = fileMeta.get(normalizedPath);

        return {
          path: normalizedPath,
          language: file?.language || null,
          score: file?.score || 1.0,
          matches: result.matches.map((match) => ({
            line: match.line,
            column: match.column,
            snippet: match.text,
            contextBefore: match.before,
            contextAfter: match.after,
          })),
        };
      });

      return {
        ok: true,
        query,
        results,
        totalMatches: results.length,
        durationMs: Date.now() - startedAt,
      };
    }

    const results: FileSearchResult[] = boostedFiles.slice(0, limit).map((file) => ({
      path: file.path,
      language: file.language,
      score: file.score,
      matches: [],
    }));

    return {
      ok: true,
      query,
      results,
      totalMatches: results.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    db.close();
  }
}
