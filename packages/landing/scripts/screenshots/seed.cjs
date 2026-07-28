/**
 * Seed data for the landing-page screenshot harness.
 *
 * These fixtures drive the *real* renderer through a stubbed electronAPI, so every
 * screenshot is a genuine render of the shipped React components â€” never a composite.
 * Keep the data presentable and generic: no personal paths, tokens, or private repos.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const now = Date.now()
const iso = (offsetMs) => new Date(now - offsetMs).toISOString()

const projects = [
  {
    id: 'p-devdesk',
    name: 'DevDesk',
    path: '~/Code/DevDesk',
    type: 'node',
    icon: 'D',
    linkedContainerNames: ['postgres', 'redis'],
    isPinned: true,
    pinnedAt: iso(3 * DAY),
  },
  {
    id: 'p-storefront',
    name: 'storefront-api',
    path: '~/Code/storefront-api',
    type: 'node',
    icon: 'S',
    linkedContainerNames: ['postgres', 'mailhog'],
    isPinned: true,
    pinnedAt: iso(2 * DAY),
  },
  {
    id: 'p-design',
    name: 'design-system',
    path: '~/Code/design-system',
    type: 'node',
    icon: 'D',
    linkedContainerNames: [],
  },
  {
    id: 'p-telemetry',
    name: 'telemetry-worker',
    path: '~/Code/telemetry-worker',
    type: 'rust',
    icon: 'T',
    linkedContainerNames: ['redis'],
  },
  {
    id: 'p-docs',
    name: 'docs-site',
    path: '~/Code/docs-site',
    type: 'node',
    icon: 'D',
    linkedContainerNames: [],
  },
  {
    id: 'p-ml',
    name: 'ml-sandbox',
    path: '~/Code/ml-sandbox',
    type: 'python',
    icon: 'M',
    linkedContainerNames: ['minio'],
  },
]

const commands = [
  {
    id: 'c-install',
    name: 'Install dependencies',
    command: 'npm install',
    description: 'Clean install using the committed lockfile.',
    tags: ['setup'],
    isPinned: true,
    pinnedAt: iso(4 * DAY),
  },
  {
    id: 'c-dev',
    name: 'Start dev server',
    command: 'npm run dev',
    description: 'Rebuild natives, start Vite, then launch Electron.',
    tags: ['dev'],
    isPinned: true,
    pinnedAt: iso(3 * DAY),
  },
  {
    id: 'c-test',
    name: 'Run tests matching a pattern',
    command: 'npm run test:run -- {{pattern}}',
    description: 'Targeted vitest run so you are not waiting on the whole suite.',
    tags: ['test', 'ci'],
    variables: [
      { name: 'pattern', default: 'commands', required: true, description: 'File or test-name filter' },
    ],
  },
  {
    id: 'c-build',
    name: 'Build production bundle',
    command: 'npm run build',
    description: 'Engine prebuild, main/preload, then the renderer bundle.',
    tags: ['build', 'release'],
  },
  {
    id: 'c-typecheck',
    name: 'Typecheck workspace',
    command: 'npm run typecheck',
    tags: ['ci'],
  },
  {
    id: 'c-package',
    name: 'Package for Windows',
    command: 'npm run package:win',
    description: 'Produces the NSIS installer in release/.',
    tags: ['release'],
  },
  {
    id: 'c-logs',
    name: 'Tail container logs',
    command: 'docker logs -f {{container}} --tail {{lines}}',
    description: 'Follow output for one of the linked containers.',
    tags: ['docker'],
    variables: [
      { name: 'container', default: 'postgres', required: true, description: 'Container name' },
      { name: 'lines', default: '200', required: false, description: 'History to include' },
    ],
  },
  {
    id: 'c-migrate',
    name: 'Apply database migrations',
    command: 'npm run db:migrate -- --env {{env}}',
    tags: ['database'],
    projectId: 'p-storefront',
    variables: [{ name: 'env', default: 'local', required: true }],
  },
]

const chains = [
  {
    id: 'ch-fresh',
    name: 'Fresh install and verify',
    description: 'What to run after pulling a branch that changed dependencies.',
    steps: [
      { id: 's1', commandId: 'c-install' },
      { id: 's2', commandId: 'c-typecheck' },
      { id: 's3', commandId: 'c-test', variables: { pattern: 'commands' } },
    ],
    stopOnFailure: true,
    parallel: false,
    createdAt: iso(6 * DAY),
    updatedAt: iso(2 * HOUR),
  },
  {
    id: 'ch-release',
    name: 'Release preflight',
    description: 'Typecheck, build, and package before tagging a release.',
    steps: [
      { id: 's1', commandId: 'c-typecheck' },
      { id: 's2', commandId: 'c-build' },
      { id: 's3', commandId: 'c-package' },
    ],
    stopOnFailure: true,
    parallel: false,
    createdAt: iso(5 * DAY),
    updatedAt: iso(1 * DAY),
  },
]

const triggers = [
  {
    id: 't-open',
    name: 'Verify deps on project open',
    description: 'Runs the fresh-install chain whenever the project is opened.',
    projectId: 'p-devdesk',
    chainId: 'ch-fresh',
    event: 'onProjectOpen',
    enabled: true,
    requireConfirmation: true,
    createdAt: iso(5 * DAY),
    updatedAt: iso(5 * DAY),
  },
]

const containers = [
  {
    id: 'ct-postgres',
    name: 'postgres',
    image: 'postgres:16-alpine',
    state: 'running',
    ports: ['0.0.0.0:5432->5432/tcp'],
    status: 'Up 2 hours (healthy)',
    createdAt: iso(2 * HOUR),
    labels: ['devdesk.stack=core'],
    command: 'docker-entrypoint.sh postgres',
  },
  {
    id: 'ct-redis',
    name: 'redis',
    image: 'redis:7-alpine',
    state: 'running',
    ports: ['0.0.0.0:6379->6379/tcp'],
    status: 'Up 2 hours',
    createdAt: iso(2 * HOUR),
    labels: ['devdesk.stack=core'],
    command: 'redis-server --appendonly yes',
  },
  {
    id: 'ct-mailhog',
    name: 'mailhog',
    image: 'mailhog/mailhog:latest',
    state: 'running',
    ports: ['0.0.0.0:1025->1025/tcp', '0.0.0.0:8025->8025/tcp'],
    status: 'Up 47 minutes',
    createdAt: iso(47 * MINUTE),
    command: 'MailHog',
  },
  {
    id: 'ct-minio',
    name: 'minio',
    image: 'minio/minio:latest',
    state: 'paused',
    ports: ['0.0.0.0:9000->9000/tcp'],
    status: 'Up 3 hours (Paused)',
    createdAt: iso(3 * HOUR),
    command: 'minio server /data',
  },
  {
    id: 'ct-legacy',
    name: 'legacy-worker',
    image: 'ghcr.io/acme/legacy-worker:0.9.2',
    state: 'stopped',
    ports: [],
    status: 'Exited (0) 5 hours ago',
    createdAt: iso(8 * HOUR),
    command: 'node worker.js',
  },
]

const containerLogs = {
  'ct-postgres': [
    '2026-07-27 12:02:11.412 UTC [1] LOG:  starting PostgreSQL 16.3 on x86_64-pc-linux-musl',
    '2026-07-27 12:02:11.419 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432',
    '2026-07-27 12:02:11.604 UTC [29] LOG:  database system was shut down at 2026-07-27 11:58:03 UTC',
    '2026-07-27 12:02:11.688 UTC [1] LOG:  database system is ready to accept connections',
    '2026-07-27 13:10:44.201 UTC [64] LOG:  checkpoint starting: time',
    '2026-07-27 13:10:47.882 UTC [64] LOG:  checkpoint complete: wrote 42 buffers (0.3%)',
    '2026-07-27 14:01:02.117 UTC [128] LOG:  connection received: host=172.18.0.1 port=54120',
    '2026-07-27 14:01:02.140 UTC [128] LOG:  connection authorized: user=devdesk database=storefront',
    '2026-07-27 14:12:38.559 UTC [131] LOG:  duration: 18.442 ms  statement: SELECT * FROM orders LIMIT 50',
    '2026-07-27 14:20:05.003 UTC [64] LOG:  checkpoint starting: time',
  ].join('\n'),
}

const runHistory = [
  {
    id: 'r-1',
    commandId: 'c-build',
    projectId: 'p-devdesk',
    status: 'success',
    startTime: iso(6 * MINUTE),
    endTime: iso(6 * MINUTE - 41_000),
    resolvedCommand: 'npm run build',
  },
  {
    id: 'r-2',
    commandId: 'c-test',
    projectId: 'p-devdesk',
    status: 'failed',
    startTime: iso(22 * MINUTE),
    endTime: iso(22 * MINUTE - 12_400),
    resolvedCommand: 'npm run test:run -- commands',
  },
  {
    id: 'r-3',
    commandId: 'c-dev',
    projectId: 'p-storefront',
    status: 'running',
    startTime: iso(31 * MINUTE),
    resolvedCommand: 'npm run dev',
  },
  {
    id: 'r-4',
    commandId: 'c-typecheck',
    projectId: 'p-devdesk',
    status: 'success',
    startTime: iso(58 * MINUTE),
    endTime: iso(58 * MINUTE - 9_800),
    resolvedCommand: 'npm run typecheck',
  },
  {
    id: 'r-5',
    commandId: 'c-migrate',
    projectId: 'p-storefront',
    status: 'success',
    startTime: iso(2 * HOUR),
    endTime: iso(2 * HOUR - 3_100),
    resolvedCommand: 'npm run db:migrate -- --env local',
  },
  {
    id: 'r-6',
    commandId: 'c-logs',
    projectId: 'p-storefront',
    status: 'stopped',
    startTime: iso(3 * HOUR),
    endTime: iso(3 * HOUR - 64_000),
    resolvedCommand: 'docker logs -f postgres --tail 200',
  },
  {
    id: 'r-7',
    commandId: 'c-install',
    projectId: 'p-telemetry',
    status: 'success',
    startTime: iso(5 * HOUR),
    endTime: iso(5 * HOUR - 27_500),
    resolvedCommand: 'npm install',
  },
]

const runOutputs = {
  'r-1': [
    '$ npm run build',
    '',
    '> devdesk@0.1.0 build',
    '> node scripts/prebuild-engine.mjs && tsc -p tsconfig.main.json && vite build',
    '',
    '[engine] cargo build --release ... done in 18.2s',
    '[engine] copied devdesk-engine to resources/engine/',
    '',
    'vite v6.4.3 building for production...',
    'transforming...',
    '\u2713 1824 modules transformed.',
    'rendering chunks...',
    'computing gzip size...',
    'dist/renderer/index.html                    2.61 kB \u2502 gzip:   1.02 kB',
    'dist/renderer/assets/vendor-react-DkP2.js  142.18 kB \u2502 gzip:  45.63 kB',
    'dist/renderer/assets/vendor-ui-B7xQ.js     196.44 kB \u2502 gzip:  61.09 kB',
    'dist/renderer/assets/index-Ck91mAsd.js     318.72 kB \u2502 gzip:  96.44 kB',
    '\u2713 built in 4.12s',
    '',
    'Build finished with exit code 0',
  ].join('\n'),
  'r-2': [
    '$ npm run test:run -- commands',
    '',
    ' \u2713 apps/desktop/services/commandRunner.test.ts (14 tests) 412ms',
    ' \u2713 apps/renderer/app/sections/CommandsSection.test.tsx (9 tests) 688ms',
    ' \u2717 apps/desktop/store/commands.test.ts (11 tests | 1 failed) 233ms',
    '',
    '   FAIL  apps/desktop/store/commands.test.ts > updateCommand > keeps tags when omitted',
    '   AssertionError: expected [ "dev" ] to deeply equal []',
    '',
    '    - Expected',
    '    + Received',
    '',
    '    - []',
    '    + [ "dev" ]',
    '',
    '      at commands.test.ts:148:34',
    '',
    ' Test Files  1 failed | 2 passed (3)',
    '      Tests  1 failed | 33 passed (34)',
    '',
    'Exited with code 1',
  ].join('\n'),
}

const engineSearchResult = {
  ok: true,
  query: 'ipcMain.handle',
  totalMatches: 12,
  durationMs: 41,
  results: [
    {
      path: 'apps/desktop/ipc/registerIpc.ts',
      language: 'typescript',
      score: 0.98,
      matches: [
        {
          line: 142,
          column: 3,
          snippet: "  ipcMain.handle('commands:run', async (_event, payload) => {",
          contextBefore: ['export function registerCommandIpc(store: DataStore) {'],
          contextAfter: ['    const result = await runCommand(store, payload)'],
        },
        {
          line: 218,
          column: 3,
          snippet: "  ipcMain.handle('projects:list', async () => store.listProjects())",
          contextBefore: ['export function registerProjectIpc(store: DataStore) {'],
          contextAfter: ['', "  ipcMain.handle('projects:add', async (_event, path: string) => {"],
        },
      ],
    },
    {
      path: 'apps/desktop/ipc/engineIpc.ts',
      language: 'typescript',
      score: 0.91,
      matches: [
        {
          line: 64,
          column: 3,
          snippet: "  ipcMain.handle('engine:search', async (_event, projectId, query) => {",
          contextBefore: ['const client = createEngineClient()'],
          contextAfter: ['    return client.search(projectId, query)'],
        },
      ],
    },
    {
      path: 'apps/desktop/ipc/dockerIpc.ts',
      language: 'typescript',
      score: 0.87,
      matches: [
        {
          line: 38,
          column: 3,
          snippet: "  ipcMain.handle('docker:containers', async () => listContainers())",
          contextBefore: ["import { listContainers } from '../services/docker'"],
          contextAfter: ['', "  ipcMain.handle('docker:start', async (_event, id: string) => {"],
        },
      ],
    },
    {
      path: 'apps/desktop/ipc/terminalIpc.ts',
      language: 'typescript',
      score: 0.79,
      matches: [
        {
          line: 27,
          column: 3,
          snippet: "  ipcMain.handle('terminal:create', async (_event, options) => {",
          contextBefore: ['const sessions = new Map<string, TerminalSession>()'],
          contextAfter: ['    const session = spawnShell(options)'],
        },
      ],
    },
    {
      path: 'docs/ipc-contracts.md',
      language: 'markdown',
      score: 0.52,
      matches: [
        {
          line: 12,
          column: 5,
          snippet: 'Every channel is registered with `ipcMain.handle` and typed in preload.ts.',
          contextBefore: ['## Conventions'],
          contextAfter: [''],
        },
      ],
    },
  ],
}

const engineStats = {
  ok: true,
  db: '~/AppData/Roaming/DevDesk/engine/p-devdesk.sqlite',
  stats: {
    totalFiles: 184,
    totalSizeBytes: 4_404_019,
    byLanguage: {
      typescript: 118,
      tsx: 34,
      rust: 12,
      markdown: 14,
      json: 6,
    },
    indexedAt: iso(2 * MINUTE),
  },
}

const gitFiles = [
  {
    path: 'packages/landing/src/sections/Features.tsx',
    indexStatus: 'M',
    workingTreeStatus: ' ',
    staged: true,
    unstaged: false,
    untracked: false,
    conflicted: false,
    summary: 'modified',
    additions: 64,
    deletions: 31,
  },
  {
    path: 'packages/landing/src/components/ScreenshotLightbox.tsx',
    indexStatus: 'A',
    workingTreeStatus: ' ',
    staged: true,
    unstaged: false,
    untracked: false,
    conflicted: false,
    summary: 'added',
    additions: 121,
    deletions: 0,
  },
  {
    path: 'packages/landing/src/config/content.ts',
    indexStatus: ' ',
    workingTreeStatus: 'M',
    staged: false,
    unstaged: true,
    untracked: false,
    conflicted: false,
    summary: 'modified',
    additions: 22,
    deletions: 18,
  },
  {
    path: 'docs/landing-page-plan.md',
    indexStatus: ' ',
    workingTreeStatus: 'M',
    staged: false,
    unstaged: true,
    untracked: false,
    conflicted: false,
    summary: 'modified',
    additions: 9,
    deletions: 2,
  },
  {
    path: 'packages/landing/public/screenshots/',
    indexStatus: '?',
    workingTreeStatus: '?',
    staged: false,
    unstaged: false,
    untracked: true,
    conflicted: false,
    summary: 'untracked',
    additions: 0,
    deletions: 0,
  },
]

const workingTree = {
  isClean: false,
  hasStagedChanges: true,
  hasUnstagedChanges: true,
  hasUntrackedChanges: true,
  hasConflicts: false,
  stagedCount: 2,
  unstagedCount: 2,
  untrackedCount: 1,
  conflictedCount: 0,
  ahead: 1,
  behind: 0,
  files: gitFiles,
}

const gitInsights = {
  branch: 'dev',
  totalCommits: 412,
  contributors: ['ada', 'grace', 'linus'],
  hotspots: [
    { path: 'apps/desktop/ipc/registerIpc.ts', score: 0.92, commits: 48, recency: 0.88, risk: 'high' },
    { path: 'apps/renderer/app/App.tsx', score: 0.81, commits: 63, recency: 0.71, risk: 'high' },
    { path: 'apps/desktop/store/dataStore.ts', score: 0.64, commits: 29, recency: 0.55, risk: 'medium' },
    { path: 'packages/engine/src/search.rs', score: 0.41, commits: 17, recency: 0.34, risk: 'low' },
  ],
  recentCommits: [
    {
      hash: '902c258',
      author: 'ada',
      date: iso(2 * HOUR),
      message: 'Present landing screenshots full-width with a lightbox',
      files: ['packages/landing/src/sections/Features.tsx'],
    },
    {
      hash: '235a819',
      author: 'ada',
      date: iso(1 * DAY),
      message: 'Add scrubbed product screenshots for landing page',
      files: ['packages/landing/public/screenshots/projects.png'],
    },
    {
      hash: 'ffe43b4',
      author: 'grace',
      date: iso(2 * DAY),
      message: 'Polish landing page for Phase 4 with Windows chrome and SEO',
      files: ['packages/landing/index.html'],
    },
    {
      hash: 'c3f3b3a',
      author: 'linus',
      date: iso(3 * DAY),
      message: 'Modernize test suite and fix critical product invariants',
      files: ['apps/desktop/store/dataStore.test.ts'],
    },
  ],
  churnFiles: [
    {
      path: 'apps/renderer/app/App.tsx',
      commits: 63,
      authors: ['ada', 'grace'],
      lastModified: iso(4 * HOUR),
      linesAdded: 1840,
      linesDeleted: 1122,
    },
    {
      path: 'apps/desktop/ipc/registerIpc.ts',
      commits: 48,
      authors: ['ada', 'linus'],
      lastModified: iso(6 * HOUR),
      linesAdded: 962,
      linesDeleted: 431,
    },
  ],
  workingTree,
}

const gitState = {
  ok: true,
  available: true,
  repoPath: '~/Code/DevDesk',
  branch: 'dev',
  upstream: 'origin/dev',
  remoteName: 'origin',
  remoteUrl: 'https://github.com/acme/devdesk.git',
  provider: 'github',
  ahead: 1,
  behind: 0,
  canPush: true,
  canCreatePullRequest: true,
  workingTree,
}

const fileDiff = {
  ok: true,
  available: true,
  path: 'packages/landing/src/sections/Features.tsx',
  sections: [
    {
      scope: 'staged',
      label: 'Staged changes',
      binary: false,
      truncated: false,
      additions: 12,
      deletions: 6,
      lines: [
        { kind: 'meta', text: 'diff --git a/Features.tsx b/Features.tsx' },
        { kind: 'hunk', text: '@@ -21,14 +21,20 @@ export function Features() {' },
        { kind: 'context', text: '       </div>', oldLineNumber: 21, newLineNumber: 21 },
        { kind: 'context', text: '', oldLineNumber: 22, newLineNumber: 22 },
        { kind: 'del', text: '      <div className="mt-14 flex flex-col gap-16">', oldLineNumber: 23 },
        { kind: 'del', text: '        {featureRows.map((row, index) => {', oldLineNumber: 24 },
        { kind: 'del', text: '          const flipped = index % 2 === 1', oldLineNumber: 25 },
        { kind: 'add', text: '      <div className="mt-14 flex flex-col gap-14 sm:gap-20">', newLineNumber: 23 },
        { kind: 'add', text: '        {featureRows.map((row) =>', newLineNumber: 24 },
        { kind: 'add', text: '          row.showScreenshot === false ? (', newLineNumber: 25 },
        { kind: 'add', text: '            <SummaryRow key={row.id} row={row} />', newLineNumber: 26 },
        { kind: 'add', text: '          ) : (', newLineNumber: 27 },
        { kind: 'add', text: '            <ShotRow key={row.id} row={row} />', newLineNumber: 28 },
        { kind: 'add', text: '          ),', newLineNumber: 29 },
        { kind: 'add', text: '        )}', newLineNumber: 30 },
        { kind: 'context', text: '      </div>', oldLineNumber: 26, newLineNumber: 31 },
        { kind: 'context', text: '    </section>', oldLineNumber: 27, newLineNumber: 32 },
      ],
    },
  ],
}

const healthReport = {
  projectId: 'p-devdesk',
  analyzedAt: iso(4 * MINUTE),
  packageManager: 'npm',
  hasNodeModules: true,
  hasLockfile: true,
  hasDockerCompose: true,
  hasGit: true,
  nodeVersion: 'v22.12.0',
  availableScripts: ['dev', 'build', 'lint', 'typecheck', 'test:run', 'package:win'],
  missingDeps: false,
  status: 'healthy',
  suggestions: [
    { id: 'h1', type: 'success', message: 'Dependencies match the committed lockfile.' },
    { id: 'h2', type: 'success', message: 'Docker Compose file detected with 3 services.' },
    {
      id: 'h3',
      type: 'info',
      message: 'Engine index is 2 minutes old.',
      action: { label: 'Reindex now' },
    },
  ],
}

/**
 * Health report for one project.
 *
 * `projectId` must echo the requested id. ProjectsSection keys its report cache by
 * `report.projectId` and its effect re-runs while any project is still missing
 * (ProjectsSection.tsx:272-304), so a fixed id leaves the other projects permanently
 * unresolved and spins inspectProject forever.
 */
const healthReportFor = (projectId) => {
  const variants = {
    'p-storefront': {
      status: 'warning',
      suggestions: [
        { id: 'h1', type: 'warning', message: 'Lockfile is newer than node_modules.' },
        { id: 'h2', type: 'info', message: 'Two migrations are pending for the local database.' },
      ],
    },
    'p-ml': {
      status: 'warning',
      suggestions: [
        { id: 'h1', type: 'warning', message: 'No virtualenv detected in the project root.' },
      ],
    },
  }

  return {
    ...healthReport,
    ...(variants[projectId] ?? {}),
    projectId,
  }
}

const terminalOutput = [
  'Windows PowerShell\r\n',
  'Copyright (C) Microsoft Corporation. All rights reserved.\r\n',
  '\r\n',
  '\u001b[32mPS\u001b[0m \u001b[36m~/Code/DevDesk\u001b[0m> npm run dev\r\n',
  '\r\n',
  '> devdesk@0.1.0 dev\r\n',
  '> node scripts/dev.mjs\r\n',
  '\r\n',
  '\u001b[90m[natives]\u001b[0m rebuilding better-sqlite3 for electron 33.4.11 ... \u001b[32mok\u001b[0m\r\n',
  '\u001b[90m[main]\u001b[0m tsc -p tsconfig.main.json ... \u001b[32mok\u001b[0m\r\n',
  '\r\n',
  '  \u001b[32mVITE\u001b[0m \u001b[2mv6.4.3\u001b[0m  ready in \u001b[1m312\u001b[0m ms\r\n',
  '\r\n',
  '  \u001b[32m\u2192\u001b[0m  Local:   \u001b[36mhttp://127.0.0.1:5180/\u001b[0m\r\n',
  '  \u001b[32m\u2192\u001b[0m  Network: use \u001b[1m--host\u001b[0m to expose\r\n',
  '\r\n',
  '\u001b[34m[electron]\u001b[0m main process online (pid 24880)\r\n',
  '\u001b[34m[electron]\u001b[0m preload bridge attached\r\n',
  '\u001b[32m[engine]\u001b[0m index ready for 2 projects (1.2s)\r\n',
  '\u001b[90m[watch]\u001b[0m watching 184 files for changes...\r\n',
  '\r\n',
  '\u001b[32mPS\u001b[0m \u001b[36m~/Code/DevDesk\u001b[0m> ',
].join('')

module.exports = {
  projects,
  commands,
  chains,
  triggers,
  containers,
  containerLogs,
  runHistory,
  runOutputs,
  engineSearchResult,
  engineStats,
  gitInsights,
  gitState,
  fileDiff,
  healthReport,
  healthReportFor,
  terminalOutput,
  iso,
}
