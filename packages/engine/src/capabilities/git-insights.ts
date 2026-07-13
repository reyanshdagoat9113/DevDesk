import { getGitInsights, isGitRepo } from '../git.js';
import type { GitInsights } from '../git.js';
import type { GitInsightsOptions } from '../types.js';
import { resolvePath } from '../utils.js';

export function getGitInsightsCapability(repoInput: string, options: GitInsightsOptions = {}): GitInsights {
  const repoPath = resolvePath(repoInput);

  if (!isGitRepo(repoPath)) {
    throw new Error('Not a git repository');
  }

  return getGitInsights(repoPath, options);
}
