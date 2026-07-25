import type {
  GitInsightsOptions,
  IndexOptions,
  IndexResult,
  SearchOptions,
  SearchResult,
  StatsResult,
} from './types.js';
import type { GitInsights } from './git.js';
import { RustWorkerClient } from './workers/client.js';
import { indexRepositoryCapability } from './capabilities/index-repository.js';
import { searchIndexCapability } from './capabilities/search.js';
import { getStatsCapability } from './capabilities/stats.js';
import { getGitInsightsCapability } from './capabilities/git-insights.js';

export class Engine {
  constructor(private readonly worker = new RustWorkerClient()) {}

  indexRepository(options: IndexOptions): Promise<IndexResult> {
    return indexRepositoryCapability({ worker: this.worker }, options);
  }

  searchIndex(options: SearchOptions): Promise<SearchResult> {
    return searchIndexCapability({ worker: this.worker }, options);
  }

  getStats(dbPath: string): StatsResult {
    return getStatsCapability(dbPath);
  }

  getGitInsights(repoPath: string, options: GitInsightsOptions = {}): GitInsights {
    return getGitInsightsCapability(repoPath, options);
  }
}
