import { Engine } from './engine.js';
import type { GitInsightsOptions, IndexOptions, SearchOptions } from './types.js';
export {
  isGitRepo,
  getHotspots,
  getFileChurn,
  getRecentCommits,
  getCurrentBranch,
  getContributors,
  getCommitCount,
  getWorkingTree,
  resolveHotspots,
  type GitInsights,
  type GitCommit,
  type FileChurn,
  type HotspotFile,
  type GitChangedFile,
  type GitWorkingTree,
  type ResolvedGitHotspot,
} from './git.js';
export type { IndexOptions, SearchOptions, GitInsightsOptions } from './types.js';

export const defaultEngine = new Engine();

export async function indexRepository(options: IndexOptions) {
  return defaultEngine.indexRepository(options);
}

export async function searchIndex(options: SearchOptions) {
  return defaultEngine.searchIndex(options);
}

export function getStats(dbPath: string) {
  return defaultEngine.getStats(dbPath);
}

export function getGitInsights(repoPath: string, options: GitInsightsOptions = {}) {
  return defaultEngine.getGitInsights(repoPath, options);
}

export { Engine };
