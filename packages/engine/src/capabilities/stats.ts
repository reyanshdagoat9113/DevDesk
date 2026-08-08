import { DatabaseManager } from '../db/index.js';
import type { StatsResult } from '../types.js';
import { normalizePath, resolvePath } from '../utils.js';

export function getStatsCapability(dbInput: string): StatsResult {
  const dbPath = resolvePath(dbInput);
  const db = new DatabaseManager(dbPath);

  try {
    const raw = db.getStats();
    return {
      ok: true,
      db: normalizePath(dbPath),
      stats: {
        totalFiles: raw.totalFiles,
        totalSizeBytes: raw.totalSizeBytes,
        searchableContentBytes: raw.searchableContentBytes,
        physicalDbBytes: raw.physicalDbBytes,
        byLanguage: raw.byLanguage,
        indexedAt: raw.indexedAt,
        largestFiles: raw.largestFiles,
      },
    };
  } finally {
    db.close();
  }
}
