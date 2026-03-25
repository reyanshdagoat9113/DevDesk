#!/usr/bin/env node

import { Command } from 'commander';
import { indexRepository, searchIndex, getStats } from './index.js';
import { getDefaultDbPath } from './utils.js';

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
  .option('--full', 'Force full reindex (ignore existing)', false)
  .action(async (path, options) => {
    const dbPath = getDefaultDbPath(path);
    const result = await indexRepository({
      repo: path,
      db: dbPath,
      incremental: !options.full,
    });
    console.log(JSON.stringify(result, null, 2));
  });

// Search command
program
  .command('search <query> [path]')
  .description('Search the index')
  .option('--regex', 'Treat query as regex', false)
  .option('-l, --limit <n>', 'Max results', '50')
  .action(async (query, path, options) => {
    const dbPath = getDefaultDbPath(path || '.');
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
  .action((path) => {
    const dbPath = getDefaultDbPath(path || '.');
    const result = getStats(dbPath);
    console.log(JSON.stringify(result, null, 2));
  });

program.parse();
