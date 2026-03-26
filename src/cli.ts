#!/usr/bin/env node

import { Command } from 'commander';
import { indexRepository, searchIndex, getStats } from './index.js';
import { getGitInsights, isGitRepo } from './git.js';
import { getDefaultDbPath, resolvePath } from './utils.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('engine')
  .description('Fast local code intelligence engine')
  .version(VERSION);

// Index command
program
  .command('index <path>')
  .description('Index a repository')
  .option('--db <path>', 'Database path')
  .option('--full', 'Force full reindex (ignore existing)', false)
  .action(async (repoPath, options) => {
    const dbPath = options.db ? resolvePath(options.db) : getDefaultDbPath(repoPath);
    const result = await indexRepository({
      repo: repoPath,
      db: dbPath,
      incremental: !options.full,
    });
    console.log(JSON.stringify(result, null, 2));
  });

// Search command
program
  .command('search <query> [path]')
  .description('Search the index')
  .option('--db <path>', 'Database path')
  .option('--regex', 'Treat query as regex', false)
  .option('-l, --limit <n>', 'Max results', '50')
  .action(async (query, repoPath, options) => {
    const dbPath = options.db
      ? resolvePath(options.db)
      : getDefaultDbPath(repoPath || '.');
    const result = await searchIndex({
      db: dbPath,
      query,
      regex: options.regex,
      limit: parseInt(options.limit, 10),
    });
    console.log(JSON.stringify(result, null, 2));
  });

// Stats command
program
  .command('stats [path]')
  .description('Show index statistics')
  .option('--db <path>', 'Database path')
  .action((repoPath, options) => {
    const dbPath = options.db
      ? resolvePath(options.db)
      : getDefaultDbPath(repoPath || '.');
    const result = getStats(dbPath);
    console.log(JSON.stringify(result, null, 2));
  });

// Git insights command
program
  .command('git <path>')
  .description('Show git insights for a repository')
  .option('-l, --limit <n>', 'Max hotspots to show', '10')
  .action((repoPath, options) => {
    try {
      if (!isGitRepo(repoPath)) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              error: 'Not a git repository',
              path: repoPath,
            },
            null,
            2
          )
        );
        return;
      }

      const result = getGitInsights(repoPath);
      console.log(
        JSON.stringify(
          {
            ok: true,
            ...result,
          },
          null,
          2
        )
      );
    } catch (error) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              path: repoPath,
            },
            null,
            2
          )
        );
    }
  });

program.parse();
