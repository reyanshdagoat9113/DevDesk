import { DatabaseManager } from '../db/index.js';
import type { StatsResult } from '../types.js';
import { normalizePath, resolvePath } from '../utils.js';

export function getStatsCapability(dbInput: string): StatsResult {
  const dbPath = resolvePath(dbInput);
  const db = new DatabaseManager(dbPath);

  try {
    const stats = db.getStats();
    return {
      ok: true,
      db: normalizePath(dbPath),
      stats,
    };
  } finally {
    db.close();
  }
}
