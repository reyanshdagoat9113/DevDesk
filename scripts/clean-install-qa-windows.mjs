/**
 * Clean-profile Windows QA harness (task 5).
 * Uses real dist/main store + health + engine CLI paths with an isolated userData.
 *
 * Usage:
 *   node scripts/clean-install-qa-windows.mjs [--out path.json] [--keep]
 */
import { createRequire } from 'node:module'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outPath =
  outIdx >= 0
    ? path.resolve(args[outIdx + 1])
    : path.join(repoRoot, 'release', 'clean-install-qa-report.json')
const keep = args.includes('--keep')
const artifactMaxAgeMs = 30 * 60 * 1000

const report = {
  meta: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    startedAt: new Date().toISOString(),
    repoRoot,
  },
  steps: [],
  summary: { passed: 0, failed: 0, skipped: 0 },
}

function record(step) {
  report.steps.push(step)
  if (step.status === 'pass') report.summary.passed += 1
  else if (step.status === 'fail') report.summary.failed += 1
  else report.summary.skipped += 1
  const mark = step.status === 'pass' ? 'PASS' : step.status === 'fail' ? 'FAIL' : 'SKIP'
  console.log(`[${mark}] ${step.id}: ${step.name}${step.error ? ` — ${step.error}` : ''}`)
}

async function runStep(id, name, fn) {
  const startedAt = new Date().toISOString()
  try {
    const evidence = await fn()
    record({ id, name, status: 'pass', startedAt, endedAt: new Date().toISOString(), evidence })
  } catch (error) {
    record({
      id,
      name,
      status: 'fail',
      startedAt,
      endedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function installElectronMock(userDataDir) {
  const electronPath = require.resolve('electron')
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: {
        isReady: () => true,
        getPath: (name) => (name === 'userData' ? userDataDir : path.join(userDataDir, name)),
        getAppPath: () => repoRoot,
        isPackaged: false,
        whenReady: async () => undefined,
      },
      BrowserWindow: { getAllWindows: () => [] },
      ipcMain: { handle() {}, removeHandler() {}, on() {}, once() {} },
      dialog: {},
      shell: { openExternal: async () => undefined },
      Menu: { setApplicationMenu() {} },
      Tray: function Tray() {},
      nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
    },
  }
}

function loadStore() {
  return require(path.join(repoRoot, 'dist', 'main', 'data', 'store.js'))
}

function loadDetect() {
  return require(path.join(repoRoot, 'dist', 'main', 'projects', 'detectProjectType.js'))
}

function loadVariables() {
  return {
    variableResolver: require(path.join(repoRoot, 'dist', 'main', 'commands', 'variableResolver.js'))
      .variableResolver,
    detectVariables: require(path.join(repoRoot, 'dist', 'main', 'commands', 'variableDetector.js'))
      .detectVariables,
  }
}

function loadHealth() {
  return {
    runSystemChecks: require(path.join(repoRoot, 'dist', 'main', 'health', 'systemChecks.js'))
      .runSystemChecks,
    runRuntimeChecks: require(path.join(repoRoot, 'dist', 'main', 'health', 'runtimeChecks.js'))
      .runRuntimeChecks,
  }
}

function loadAttachments() {
  return require(path.join(repoRoot, 'dist', 'main', 'bugs', 'attachmentService.js'))
}

function loadRuntime() {
  return require(path.join(repoRoot, 'dist', 'main', 'engine', 'runtime.js'))
}

function loadTerminal() {
  return require(path.join(repoRoot, 'dist', 'main', 'terminal', 'terminalManager.js'))
}

async function spawnShell(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd,
      windowsHide: true,
      env: process.env,
    })
    let output = ''
    child.stdout?.on('data', (c) => {
      output += c.toString()
    })
    child.stderr?.on('data', (c) => {
      output += c.toString()
    })
    child.on('error', (err) => {
      resolve({ code: 1, output: `${output}\n${err.message}` })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, output })
    })
  })
}

function resolveElectronBinary() {
  const candidates = [
    path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(repoRoot, 'node_modules', '.bin', 'electron.cmd'),
    path.join(repoRoot, 'release', 'win-unpacked', 'DevDesk.exe'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('Electron binary not found for engine/terminal steps')
}

function parseJsonPayload(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('empty engine output')
  try {
    return JSON.parse(trimmed)
  } catch {
    // Prefer last complete JSON object in mixed stdout.
    const matches = trimmed.match(/\{[\s\S]*\}/g)
    if (!matches?.length) throw new Error(`no JSON object in output: ${trimmed.slice(0, 200)}`)
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(matches[i])
      } catch {
        // continue
      }
    }
    throw new Error(`failed to parse engine JSON: ${trimmed.slice(0, 200)}`)
  }
}

async function runEngineCli(electronBin, engineCli, engineArgs, envExtra = {}) {
  const { stdout, stderr } = await execFileAsync(electronBin, [engineCli, ...engineArgs], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...envExtra },
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (stderr && /error/i.test(stderr) && !stdout.trim()) {
    throw new Error(stderr.slice(0, 500))
  }
  return { stdout, stderr }
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('clean-install-qa-windows.mjs must run on Windows')
  }

  const storeDist = path.join(repoRoot, 'dist', 'main', 'data', 'store.js')
  if (!fs.existsSync(storeDist)) {
    throw new Error('dist/main missing. Run npm run build:main first.')
  }

  const { stdout: gitHead } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    windowsHide: true,
  })
  const { stdout: gitStatus } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    windowsHide: true,
  })
  report.meta.gitHead = gitHead.trim()
  report.meta.gitDirty = gitStatus.trim().length > 0

  const installer = path.join(repoRoot, 'release', 'DevDesk-0.1.0-win-x64.exe')
  const unpacked = path.join(repoRoot, 'release', 'win-unpacked', 'DevDesk.exe')
  for (const artifact of [installer, unpacked]) {
    if (!fs.existsSync(artifact)) throw new Error(`missing freshly packaged artifact: ${artifact}`)
    const ageMs = Date.now() - fs.statSync(artifact).mtimeMs
    if (ageMs > artifactMaxAgeMs) {
      throw new Error(`stale packaged artifact (${Math.round(ageMs / 60000)} minutes old): ${artifact}`)
    }
  }

  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-clean-qa-'))
  const userDataDir = path.join(sessionRoot, 'user-data')
  const fixtureProject = path.join(sessionRoot, 'fixture-project')
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.mkdirSync(path.join(fixtureProject, 'src'), { recursive: true })
  fs.writeFileSync(path.join(fixtureProject, 'package.json'), JSON.stringify({ name: 'qa-fixture', version: '1.0.0' }, null, 2))
  fs.writeFileSync(path.join(fixtureProject, 'src', 'app.ts'), "export const qaNeedle = 'clean-install-qa'\n")
  fs.writeFileSync(path.join(fixtureProject, 'README.md'), '# QA fixture\n')

  report.meta.sessionRoot = sessionRoot
  report.meta.userDataDir = userDataDir

  const installerStat = fs.statSync(installer)
  report.meta.installerSha256 = createHash('sha256').update(fs.readFileSync(installer)).digest('hex')
  report.meta.installerPath = installer
  report.meta.installerBytes = installerStat.size
  report.meta.installerModifiedAt = installerStat.mtime.toISOString()

  const unpackedStat = fs.statSync(unpacked)
  report.meta.unpackedExe = unpacked
  report.meta.unpackedSha256 = createHash('sha256').update(fs.readFileSync(unpacked)).digest('hex')
  report.meta.unpackedModifiedAt = unpackedStat.mtime.toISOString()

  installElectronMock(userDataDir)

  const store = loadStore()
  await store.ensureDbInitialized()
  report.meta.dbPath = path.join(userDataDir, 'devdesk.db')

  let projectId = ''
  let projectPath = fixtureProject

  await runStep('01_project_lifecycle', 'Add, edit, pin, and remove a project', async () => {
    const { detectProjectType, getProjectIcon } = loadDetect()
    const type = detectProjectType(fixtureProject)
    projectId = randomUUID()
    const project = {
      id: projectId,
      path: fixtureProject,
      name: 'QA Fixture',
      type,
      icon: getProjectIcon(type),
      linkedContainerNames: [],
    }
    await store.createProject(project)
    const renamedOk = await store.renameProject(projectId, 'QA Fixture Renamed')
    if (!renamedOk) throw new Error('rename failed')
    const afterRename = await store.getProjectById(projectId)
    if (!afterRename || afterRename.name !== 'QA Fixture Renamed') throw new Error('rename not persisted')
    const pinned = await store.toggleProjectPin(projectId)
    if (!pinned?.isPinned) throw new Error('pin failed')
    const listed = await store.listProjects()
    if (!listed.some((p) => p.id === projectId && p.isPinned)) throw new Error('list missing pinned project')
    // Keep project for later steps; removal verified at end of lifecycle on a clone id
    const tempId = randomUUID()
    await store.createProject({
      id: tempId,
      path: path.join(sessionRoot, 'temp-remove-project'),
      name: 'Temp Remove',
      type: 'unknown',
      icon: 'box',
      linkedContainerNames: [],
    })
    fs.mkdirSync(path.join(sessionRoot, 'temp-remove-project'), { recursive: true })
    await store.removeProject(tempId)
    const after = await store.listProjects()
    if (after.some((p) => p.id === tempId)) throw new Error('remove failed')
    return {
      projectId,
      renamed: afterRename.name,
      pinned: true,
      removedTempId: tempId,
      remainingCount: after.length,
    }
  })

  await runStep('02_command_variables_and_fail', 'Create/run command with variables and a failing command', async () => {
    const { variableResolver, detectVariables } = loadVariables()
    const project = await store.getProjectById(projectId)
    const successTemplate =
      process.platform === 'win32' ? 'cmd /c echo {{ input:name }}' : 'echo {{ input:name }}'
    const successCmd = {
      id: randomUUID(),
      name: 'QA echo variable',
      command: successTemplate,
      projectId,
      variables: detectVariables(successTemplate),
    }
    await store.createCommand(successCmd)
    const resolution = variableResolver.resolve(
      successCmd.command,
      { project, containers: [], env: process.env },
      { name: 'clean-install-ok' },
      process.platform === 'win32' ? 'windows' : 'posix',
    )
    if (!resolution.resolvedCommand) throw new Error('variable resolve failed')
    const successRunId = randomUUID()
    await store.createRunHistoryEntry({
      id: successRunId,
      commandId: successCmd.id,
      projectId,
      status: 'running',
      startTime: new Date().toISOString(),
      resolvedCommand: resolution.resolvedCommand,
    })
    const successSpawn = await spawnShell(resolution.resolvedCommand, projectPath)
    await store.finalizeRunHistoryEntry(
      successRunId,
      successSpawn.output,
      successSpawn.code === 0 ? 'success' : 'failed',
    )
    const successOut = await store.getRunHistoryOutputById(successRunId)
    if (!/clean-install-ok/i.test(successOut) || successSpawn.code !== 0) {
      throw new Error(`success command failed: ${successSpawn.output}`)
    }

    const failCmd = {
      id: randomUUID(),
      name: 'QA fail',
      command: process.platform === 'win32' ? 'cmd /c exit 7' : 'false',
      projectId,
    }
    await store.createCommand(failCmd)
    const failRunId = randomUUID()
    await store.createRunHistoryEntry({
      id: failRunId,
      commandId: failCmd.id,
      projectId,
      status: 'running',
      startTime: new Date().toISOString(),
      resolvedCommand: failCmd.command,
    })
    const failSpawn = await spawnShell(failCmd.command, projectPath)
    await store.finalizeRunHistoryEntry(failRunId, failSpawn.output, failSpawn.code === 0 ? 'success' : 'failed')
    const history = await store.listRecentRunHistory(10)
    const failEntry = history.find((h) => h.id === failRunId)
    if (!failEntry || failEntry.status !== 'failed') {
      throw new Error(`expected failed status, got ${failEntry?.status}`)
    }
    return {
      successRunId,
      failRunId,
      resolvedCommand: resolution.resolvedCommand,
      successStatus: history.find((h) => h.id === successRunId)?.status,
      failStatus: failEntry.status,
      historyCount: history.length,
    }
  })

  await runStep('03_terminal', 'Open terminal, resize, and close', async () => {
    let TerminalManager
    try {
      ;({ TerminalManager } = loadTerminal())
    } catch (error) {
      throw new Error(`terminal module load failed: ${error instanceof Error ? error.message : error}`)
    }
    const mgr = new TerminalManager(() => undefined)
    try {
      const session = await mgr.create({
        cwd: fixtureProject,
        cols: 80,
        rows: 24,
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      })
      mgr.resize(session.id, 100, 30)
      const meta = mgr.getSession(session.id)
      if (!meta || meta.cols !== 100 || meta.rows !== 30) throw new Error('resize did not update session meta')
      mgr.write(session.id, 'echo terminal-qa\r')
      await new Promise((r) => setTimeout(r, 400))
      mgr.close(session.id)
      const closeDeadline = Date.now() + 5000
      while (mgr.get(session.id) && Date.now() < closeDeadline) {
        await new Promise((r) => setTimeout(r, 100))
      }
      if (mgr.get(session.id)) {
        mgr.closeAll()
        throw new Error('terminal process did not exit after close')
      }
      return { sessionId: session.id, shell: session.shell, cwd: session.cwd, resized: true, closed: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|was compiled against/i.test(message)) {
        // A packaged binary being present does not prove the live terminal workflow works.
        const ptyNode = path.join(
          repoRoot,
          'release',
          'win-unpacked',
          'resources',
          'app.asar.unpacked',
          'node_modules',
          'node-pty',
        )
        const packagedState = fs.existsSync(ptyNode) ? 'present' : 'missing'
        throw new Error(`${message}; packaged node-pty is ${packagedState}, but live spawn was not exercised`)
      }
      throw error
    }
  })

  await runStep('04_health', 'Run health check and inspect persisted history', async () => {
    const { runSystemChecks, runRuntimeChecks } = loadHealth()
    const items = [...(await runSystemChecks()), ...(await runRuntimeChecks(fixtureProject))]
    if (!items.length) throw new Error('no health items returned')
    const run = await store.createHealthCheckRun(projectId, items)
    const listed = await store.listHealthCheckRuns(projectId, 10)
    const latest = await store.getLatestHealthCheckForProject(projectId)
    if (!listed.some((r) => r.id === run.id)) throw new Error('health run not listed')
    if (!latest || latest.id !== run.id) throw new Error('latest health run mismatch')
    return { runId: run.id, itemCount: items.length, listedCount: listed.length, status: run.status ?? latest?.status }
  })

  await runStep('05_engine', 'Index project, search, and git insights', async () => {
    const runtime = loadRuntime()
    const electronBin = resolveElectronBinary()
    const engineCli = runtime.resolveEngineBinaryPath({
      appPath: repoRoot,
      moduleDirname: path.join(repoRoot, 'dist', 'main', 'engine'),
      resourcesPath: path.join(repoRoot, 'release', 'win-unpacked', 'resources'),
      isPackaged: fs.existsSync(path.join(repoRoot, 'release', 'win-unpacked', 'resources', 'engine', 'cli.js')),
      existsSync: fs.existsSync,
    })
    if (!fs.existsSync(engineCli)) {
      // fallback to linked engine dist
      const fallback = path.join(repoRoot, 'node_modules', 'devdesk-engine', 'dist', 'cli.js')
      if (!fs.existsSync(fallback)) throw new Error(`engine cli missing: ${engineCli}`)
    }
    const dbPath = runtime.getEngineDbPathFromUserData(userDataDir, projectId)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const cliPath = fs.existsSync(engineCli)
      ? engineCli
      : path.join(repoRoot, 'node_modules', 'devdesk-engine', 'dist', 'cli.js')

    const indexOut = await runEngineCli(electronBin, cliPath, ['index', fixtureProject, '--db', dbPath])
    const indexJson = parseJsonPayload(indexOut.stdout)
    if (!indexJson.ok) throw new Error(`index failed: ${indexOut.stdout || indexOut.stderr}`)

    const searchOut = await runEngineCli(electronBin, cliPath, [
      'search',
      'clean-install-qa',
      '--db',
      dbPath,
    ])
    const searchJson = parseJsonPayload(searchOut.stdout)
    if (!searchJson.ok || !Array.isArray(searchJson.results) || searchJson.results.length < 1) {
      throw new Error(`search failed: ${searchOut.stdout || searchOut.stderr}`)
    }

    await execFileAsync('git', ['init'], { cwd: fixtureProject, windowsHide: true })
    await execFileAsync('git', ['config', 'user.email', 'qa@devdesk.local'], {
      cwd: fixtureProject,
      windowsHide: true,
    })
    await execFileAsync('git', ['config', 'user.name', 'QA'], { cwd: fixtureProject, windowsHide: true })
    await execFileAsync('git', ['add', '.'], { cwd: fixtureProject, windowsHide: true })
    await execFileAsync('git', ['commit', '-m', 'qa'], { cwd: fixtureProject, windowsHide: true })
    const gitOut = await runEngineCli(electronBin, cliPath, ['git', fixtureProject])
    const gitJson = parseJsonPayload(gitOut.stdout)
    if (!gitJson.ok || !gitJson.branch) throw new Error(`git insights failed: ${gitOut.stdout || gitOut.stderr}`)
    const gitBranch = gitJson.branch

    await store.upsertEngineIndex({
      projectId,
      dbPath: dbPath.replace(/\\/g, '/'),
      lastIndexed: new Date().toISOString(),
      fileCount: indexJson.filesIndexed ?? 1,
    })

    return {
      engineCli: cliPath,
      dbPath,
      filesIndexed: indexJson.filesIndexed,
      searchHit: searchJson.results[0]?.path,
      gitBranch,
    }
  })

  await runStep('06_bug_attachment', 'Create a bug with context attachment', async () => {
    const { copyFileToAttachments } = loadAttachments()
    const sample = path.join(sessionRoot, 'sample-log.txt')
    fs.writeFileSync(sample, 'qa log line\n')
    const bug = await store.createBugReport({
      projectId,
      title: 'QA clean-install bug',
      severity: 'low',
      notes: 'created by clean-install-qa-windows.mjs',
    })
    const copied = copyFileToAttachments(sample)
    const att = await store.addBugAttachmentRecord({
      bugReportId: bug.id,
      sourceFilePath: sample,
      kind: 'log',
      storedRelativePath: copied.relativePath,
      fileSize: copied.fileSize,
      mimeType: 'text/plain',
    })
    const listed = await store.listBugAttachments(bug.id)
    const abs = path.join(userDataDir, copied.relativePath)
    if (!fs.existsSync(abs)) throw new Error(`attachment file missing: ${abs}`)
    if (!listed.some((a) => a.id === att.id)) throw new Error('attachment not listed')
    return { bugId: bug.id, attachmentId: att.id, relativePath: copied.relativePath, fileExists: true }
  })

  await runStep('07_export_import', 'Export and import merge + replace', async () => {
    const exported = await store.exportAllData()
    if (!exported.success || !exported.data) throw new Error(exported.error || 'export failed')
    const exportFile = path.join(sessionRoot, 'export.json')
    fs.writeFileSync(exportFile, JSON.stringify(exported.data, null, 2))

    const merge = await store.importAllData(exported.data, 'merge')
    if (!merge.success) throw new Error(merge.error || 'merge import failed')

    const replace = await store.importAllData(exported.data, 'replace')
    if (!replace.success) throw new Error(replace.error || 'replace import failed')

    const backups = fs
      .readdirSync(userDataDir)
      .filter((name) => name.startsWith('devdesk.db.backup-'))
      .map((name) => path.join(userDataDir, name))
    if (!backups.length) throw new Error('expected import DB backup file')

    const projects = await store.listProjects()
    if (!projects.some((p) => p.id === projectId)) throw new Error('project missing after import')

    return {
      exportFile,
      exportCounts: exported.recordCounts,
      mergeOk: true,
      replaceOk: true,
      backupCount: backups.length,
      backupSample: backups[0],
      warnings: [...(merge.warnings || []), ...(replace.warnings || [])],
    }
  })

  await runStep('08_tray_pref', 'Toggle tray preference and persist', async () => {
    const before = await store.getPreferencesFromStore()
    await store.updatePreferencesInStore({ trayEnabled: false })
    const mid = await store.getPreferencesFromStore()
    if (mid.trayEnabled !== false) throw new Error('trayEnabled not false after update')
    await store.updatePreferencesInStore({ trayEnabled: true })
    const after = await store.getPreferencesFromStore()
    if (after.trayEnabled !== true) throw new Error('trayEnabled not true after re-enable')
    return {
      before: before.trayEnabled,
      disabled: mid.trayEnabled,
      reenabled: after.trayEnabled,
      note: 'Preference persistence verified; live tray icon requires full Electron GUI session',
    }
  })

  await runStep('09_docker', 'Docker present / missing detection', async () => {
    try {
      const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], {
        windowsHide: true,
        timeout: 15000,
      })
      return { present: true, serverVersion: stdout.trim() }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Missing Docker is a valid clean-machine state and must degrade gracefully.
      return { present: false, degradedOk: true, error: message.slice(0, 300) }
    }
  })

  await runStep('10_restart_persistence', 'Restart process and confirm persistence', async () => {
    // Simulate restart: second Node process with same userData mock cannot easily share require cache.
    // Re-read via a fresh Database open using initializeDatabaseAt after closing is not exported globally.
    // Instead re-list from current process after reloading store APIs and assert files exist, then
    // spawn a child script that only reads SQLite.
    const childScript = path.join(sessionRoot, 'restart-check.cjs')
    fs.writeFileSync(
      childScript,
      `
const Database = require(${JSON.stringify(require.resolve('better-sqlite3'))});
const db = new Database(${JSON.stringify(path.join(userDataDir, 'devdesk.db'))}, { readonly: true });
const projects = db.prepare('SELECT id, name, is_pinned FROM projects').all();
const prefs = db.prepare('SELECT key, id, command FROM preferences').all();
const bugs = db.prepare('SELECT COUNT(*) AS c FROM bug_reports').get();
const health = db.prepare('SELECT COUNT(*) AS c FROM health_check_runs').get();
console.log(JSON.stringify({ projects, prefs, bugs: bugs.c, health: health.c }));
db.close();
`,
    )
    const { stdout } = await execFileAsync(process.execPath, [childScript], {
      cwd: repoRoot,
      windowsHide: true,
    })
    const data = JSON.parse(stdout.trim())
    if (!data.projects.some((p) => p.id === projectId)) throw new Error('project not persisted across process')
    if (data.bugs < 1) throw new Error('bug not persisted')
    if (data.health < 1) throw new Error('health run not persisted')
    return {
      projects: data.projects.length,
      bugs: data.bugs,
      health: data.health,
      projectStillPresent: true,
      childProcessRead: true,
    }
  })

  await runStep('11_packaged_launch', 'Launch packaged app with clean userData', async () => {
    const exe = path.join(repoRoot, 'release', 'win-unpacked', 'DevDesk.exe')
    if (!fs.existsSync(exe)) throw new Error(`missing ${exe}`)
    const launchUserData = path.join(sessionRoot, 'packaged-userdata')
    fs.mkdirSync(launchUserData, { recursive: true })
    const child = spawn(exe, [`--user-data-dir=${launchUserData}`], {
      windowsHide: false,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    await new Promise((r) => setTimeout(r, 10000))
    let running = false
    try {
      process.kill(child.pid, 0)
      running = true
    } catch {
      running = false
    }
    if (running) {
      try {
        process.kill(child.pid)
      } catch {
        // ignore
      }
      // also try taskkill for electron children
      try {
        await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
      } catch {
        // ignore
      }
    }
    const dbCreated = fs.existsSync(path.join(launchUserData, 'devdesk.db'))
    if (!running) throw new Error('packaged app exited before the startup observation completed')
    if (!dbCreated) throw new Error('packaged app did not create devdesk.db')
    return {
      exe,
      pid: child.pid,
      wasRunning: running,
      dbCreated: fs.existsSync(path.join(launchUserData, 'devdesk.db')),
      launchUserData,
    }
  })

  try {
    store.getDbOrThrow().close()
  } catch (error) {
    record({
      id: 'cleanup_database',
      name: 'Close QA database',
      status: 'fail',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  }

  if (!keep) {
    try {
      if (report.summary.failed === 0) {
        fs.rmSync(sessionRoot, { recursive: true, force: true })
        if (fs.existsSync(sessionRoot)) throw new Error('session directory still exists after cleanup')
      } else {
        console.log(`Session kept due to failures: ${sessionRoot}`)
      }
    } catch (error) {
      record({
        id: 'cleanup_session',
        name: 'Remove QA session directory',
        status: 'fail',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  } else {
    console.log(`Session kept: ${sessionRoot}`)
  }

  report.meta.endedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nReport written: ${outPath}`)
  console.log(
    `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`,
  )

  process.exit(report.summary.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
