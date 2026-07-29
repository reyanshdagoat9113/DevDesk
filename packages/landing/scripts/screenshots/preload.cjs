/**
 * Preload for the screenshot harness. Exposes a fully stubbed `electronAPI` so the
 * real renderer boots against fixtures instead of SQLite / Docker / the engine binary.
 *
 * Read paths return seed data; write paths are inert no-ops. Anything not explicitly
 * stubbed resolves to a benign value and is logged, so a missing stub shows up as a
 * console warning rather than an unhandled rejection that blanks the UI.
 */
const { contextBridge } = require('electron')
const seed = require('./seed.cjs')

const handlers = Object.create(null)
const emittedLogs = new Set()

const subscribe = (event) => (handler) => {
  if (!handlers[event]) handlers[event] = new Set()
  handlers[event].add(handler)
  return () => handlers[event].delete(handler)
}

function emit(event, payload) {
  for (const handler of handlers[event] ?? []) {
    try {
      handler(payload)
    } catch (error) {
      console.error('[shots] handler threw for', event, error)
    }
  }
}

const ok = async () => ({ success: true })

const api = {
  platform: 'win32',

  // ── bootstrap ────────────────────────────────────────────────────
  getProjects: async () => seed.projects,
  getCommands: async () => seed.commands,
  getChains: async () => seed.chains,
  getTriggers: async () => seed.triggers,
  getPendingTriggerConfirmations: async () => [],
  getRunHistory: async () => seed.runHistory,
  getContainers: async () => seed.containers,
  listWslDistros: async () => ['Ubuntu-22.04'],
  getPreferences: async () => ({
    editor: { id: 'vscode' },
    terminal: { id: 'windows-terminal' },
    trayEnabled: true,
  }),
  getEngineState: async () => ({
    status: { available: true, version: '0.1.0' },
    indexes: {
      'p-devdesk': {
        projectId: 'p-devdesk',
        dbPath: seed.engineStats.db,
        lastIndexed: seed.iso(2 * 60 * 1000),
        fileCount: 184,
      },
    },
    // Seeding a completed session makes the Engine view render results on load,
    // with no typing or debounce to race against.
    searchSessions: {
      'p-devdesk': {
        projectId: 'p-devdesk',
        query: seed.engineSearchResult.query,
        regex: false,
        updatedAt: seed.iso(2 * 60 * 1000),
        result: seed.engineSearchResult,
      },
    },
  }),

  // ── projects ─────────────────────────────────────────────────────
  inspectProject: async (projectId) => seed.healthReportFor(projectId),
  getProjectNotes: async (projectId) => ({
    projectId,
    setupSteps: '1. npm install\n2. cp .env.example .env\n3. npm run dev',
    todos: '- Split the run history query\n- Add a retry to the engine client',
    reminders: 'Staging deploy runs on Thursday.',
  }),
  getProjectGitState: async () => seed.gitState,
  getProjectGitInsights: async () => seed.gitInsights,
  // Must echo the requested path. Returning a fixed path makes the git panel see a
  // mismatch between what it asked for and what it got, re-request, and livelock.
  getProjectFileDiff: async (_projectId, relativePath) => ({
    ...seed.fileDiff,
    path: relativePath ?? seed.fileDiff.path,
  }),
  getProjectStats: async () => seed.engineStats,
  searchProjectContent: async () => seed.engineSearchResult,
  isEngineAvailable: async () => true,
  indexProject: async () => ({
    ok: true,
    repo: '~/Code/DevDesk',
    db: seed.engineStats.db,
    filesIndexed: 184,
    filesSkipped: 3,
    durationMs: 1204,
    warnings: [],
  }),
  listProjectFiles: async () => ({ entries: [], truncated: false }),
  searchProjectFiles: async () => [],
  getProjectDirectories: async () => ['apps', 'packages', 'scripts', 'docs'],

  // ── containers ───────────────────────────────────────────────────
  getContainerLogs: async (id) => seed.containerLogs[id] ?? seed.containerLogs['ct-postgres'],
  // Emit each subscription's payload at most once. Re-emitting on every subscribe call
  // makes the linked-container log panels churn state, re-subscribe, and livelock the
  // renderer a second or two after the Projects view mounts.
  subscribeContainerLogs: async (id) => {
    const subscriptionId = `sub-${id}`
    if (!emittedLogs.has(subscriptionId)) {
      emittedLogs.add(subscriptionId)
      const chunk = seed.containerLogs[id] ?? seed.containerLogs['ct-postgres']
      setTimeout(() => emit('docker:logs:data', { subscriptionId, containerId: id, chunk }), 60)
    }
    return { subscriptionId }
  },
  unsubscribeContainerLogs: ok,

  // ── history ──────────────────────────────────────────────────────
  getRunOutput: async (runId) => seed.runOutputs[runId] ?? seed.runOutputs['r-1'],
  listRecentHistory: async () => seed.runHistory,

  // ── health ───────────────────────────────────────────────────────
  runHealthCheck: async () => null,
  getLatestHealthCheck: async () => null,
  listHealthCheckRuns: async () => [],
  getHealthCheckRun: async () => null,

  // ── bugs ─────────────────────────────────────────────────────────
  listBugs: async () => ({ ok: true, data: [] }),
  listBugAttachments: async () => ({ ok: true, data: [] }),
  getBugContextSnapshot: async () => ({ ok: true, data: null }),

  // ── terminal ─────────────────────────────────────────────────────
  createTerminal: async () => {
    const terminalId = 'term-1'
    // Feed the seeded session once xterm has mounted and sized itself.
    setTimeout(() => emit('terminal:data', { terminalId, data: seed.terminalOutput }), 260)
    return { terminalId }
  },
  writeTerminal: async () => undefined,
  resizeTerminal: async () => undefined,
  closeTerminal: async () => undefined,

  // ── commands ─────────────────────────────────────────────────────
  // Must genuinely parse {{placeholders}}: returning [] while a command string still
  // contains them makes CommandsSection re-detect on every render and spin forever.
  detectCommandVariables: async (command) => {
    const text = String(command ?? '')
    const seeded = seed.commands.find((entry) => entry.command === text)
    if (seeded?.variables) return seeded.variables

    const names = []
    for (const match of text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
      if (!names.includes(match[1])) names.push(match[1])
    }
    return names.map((name) => ({ name, required: true }))
  },

  // ── subscriptions ────────────────────────────────────────────────
  onRunStarted: subscribe('runs:started'),
  onRunOutput: subscribe('runs:output'),
  onRunStatus: subscribe('runs:status'),
  onChainProgress: subscribe('chains:progress'),
  onTriggerConfirmationRequested: subscribe('triggers:confirmation-requested'),
  onContainerLogsData: subscribe('docker:logs:data'),
  onContainerLogsEnd: subscribe('docker:logs:end'),
  onContainerLogsError: subscribe('docker:logs:error'),
  onEngineIndexingStarted: subscribe('engine:indexing-started'),
  onEngineIndexingCompleted: subscribe('engine:indexing-completed'),
  onTerminalData: subscribe('terminal:data'),
  onTerminalExit: subscribe('terminal:exit'),
  onTerminalError: subscribe('terminal:error'),
  onTrayTerminalCreated: subscribe('tray:terminal-created'),

  llm: {
    bundleContext: async () => ({
      markdown: '# Context\n',
      tokenEstimate: 0,
      includedFiles: [],
      excludedFiles: [],
      warnings: [],
    }),
  },
}

// Inert defaults for every remaining channel, so no view can crash the capture.
const inert = {
  addProject: async () => seed.projects[0],
  removeProject: ok,
  updateProject: async () => seed.projects[0],
  toggleProjectPin: async () => seed.projects[0],
  setProjectLinkedContainers: async () => seed.projects[0],
  startProjectDevStack: async () => ({ success: true, started: [], resumed: [], alreadyRunning: [], missing: [] }),
  stopProjectDevStack: async () => ({ success: true, stopped: [], alreadyStopped: [], missing: [] }),
  restartProjectDevStack: async () => ({ success: true, stopped: [], started: [], missing: [] }),
  openProjectFolderDialog: async () => ({ canceled: true }),
  openProjectFolder: ok,
  openProjectInEditor: ok,
  openProjectInTerminal: ok,
  updatePreferences: ok,
  updateProjectNotes: async () => undefined,
  createBug: async () => ({ ok: true, data: null }),
  updateBug: async () => ({ ok: true, data: null }),
  deleteBug: async () => ({ ok: true, data: { success: true } }),
  getBug: async () => ({ ok: true, data: null }),
  captureContext: async () => ({ ok: true, data: null }),
  addBugAttachment: async () => ({ ok: true, data: null }),
  removeBugAttachment: async () => ({ ok: true, data: { success: true } }),
  pickAttachmentFile: async () => ({ ok: true, data: { canceled: true, filePaths: [] } }),
  addCommand: async () => seed.commands[0],
  updateCommand: async () => seed.commands[0],
  toggleCommandPin: async () => seed.commands[0],
  removeCommand: ok,
  runCommand: async () => ({ runId: 'r-new', status: 'running', startTime: new Date().toISOString() }),
  runAdhocCommand: async () => ({ runId: 'r-new', status: 'running', startTime: new Date().toISOString() }),
  stopCommand: ok,
  addChain: async () => seed.chains[0],
  updateChain: async () => seed.chains[0],
  removeChain: ok,
  runChain: async () => ({ runId: 'r-new', status: 'running' }),
  addTrigger: async () => seed.triggers[0],
  updateTrigger: async () => seed.triggers[0],
  removeTrigger: ok,
  notifyTriggerEvent: ok,
  respondToTriggerConfirmation: ok,
  startContainer: ok,
  stopContainer: ok,
  restartContainer: ok,
  pauseContainer: ok,
  unpauseContainer: ok,
  removeContainer: ok,
  clearRunHistory: ok,
  removeRunHistory: ok,
  openFileInEditor: ok,
  revealFileInFolder: ok,
  clearFileIndex: ok,
  openExternalUrl: ok,
  commitProjectChanges: async () => ({ ok: true, message: 'nothing to commit', branch: 'dev' }),
  pushProjectBranch: async () => ({ ok: true, message: 'up to date', branch: 'dev', remoteName: 'origin', remoteUrl: '' }),
  createProjectPullRequest: async () => ({ ok: true, message: '', branch: 'dev', baseBranch: 'main', isDraft: false }),
  clearProjectIndex: ok,
  clearProjectSearchSession: ok,
  exportData: async () => ({ success: true, data: null, recordCounts: {} }),
  exportDataToFile: async () => ({ success: true, canceled: true }),
  previewImportFile: async () => ({ success: true, canceled: true }),
  importData: async () => ({ success: true, recordCounts: {} }),
}

for (const [key, value] of Object.entries(inert)) {
  if (!(key in api)) api[key] = value
}

// Opt-in call tracing. A livelocked renderer cannot answer executeJavaScript, so counts
// are flushed to disk instead of reported over IPC. Enable with SHOTS_TRACE=1.
if (process.env.SHOTS_TRACE === '1') {
  const fsSync = require('node:fs')
  const tracePath = require('node:path').join(__dirname, 'trace.json')
  const counts = Object.create(null)
  let scheduled = false

  const flush = () => {
    scheduled = false
    try {
      fsSync.writeFileSync(tracePath, JSON.stringify(counts, null, 2))
    } catch {
      /* ignore */
    }
  }

  for (const key of Object.keys(api)) {
    const original = api[key]
    if (typeof original !== 'function') continue
    api[key] = (...args) => {
      counts[key] = (counts[key] || 0) + 1
      if (!scheduled) {
        scheduled = true
        setTimeout(flush, 250)
      }
      return original(...args)
    }
  }
  try {
    fsSync.writeFileSync(tracePath, '{}')
  } catch {
    /* ignore */
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
contextBridge.exposeInMainWorld('__shots', {
  emit: (event, payload) => emit(event, payload),
})
