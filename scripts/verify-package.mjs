/**
 * Verify an unpacked electron-builder output contains the engine and can index/search.
 *
 * Usage:
 *   node scripts/verify-package.mjs --platform win
 *   node scripts/verify-package.mjs --platform linux
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parsePlatform(argv) {
  const flagIndex = argv.indexOf('--platform')
  const value = flagIndex >= 0 ? argv[flagIndex + 1] : argv.find((arg) => !arg.startsWith('-'))
  if (value === 'win' || value === 'windows') return 'win'
  if (value === 'linux') return 'linux'
  throw new Error('Usage: node scripts/verify-package.mjs --platform <win|linux>')
}

function getUnpackedDir(platform) {
  if (platform === 'win') {
    return path.join(repoRoot, 'release', 'win-unpacked')
  }
  return path.join(repoRoot, 'release', 'linux-unpacked')
}

function getPackagedElectronBinary(platform, unpackedDir) {
  if (platform === 'win') {
    return path.join(unpackedDir, 'DevDesk.exe')
  }
  return path.join(unpackedDir, 'devdesk')
}

function buildNodePath(resourcesDir) {
  return [
    path.join(resourcesDir, 'engine', 'node_modules'),
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules'),
    path.join(resourcesDir, 'app.asar', 'node_modules'),
    process.env.NODE_PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter)
}

async function main() {
  const platform = parsePlatform(process.argv.slice(2))
  const unpackedDir = getUnpackedDir(platform)
  const resourcesDir = path.join(unpackedDir, 'resources')
  const engineCliPath = path.join(resourcesDir, 'engine', 'cli.js')
  const engineRunnerPath = path.join(resourcesDir, 'engine', 'runner.js')
  const enginePackageJson = path.join(resourcesDir, 'engine', 'package.json')
  const packagedElectron = getPackagedElectronBinary(platform, unpackedDir)
  const electronBinaryPath = existsSync(packagedElectron)
    ? packagedElectron
    : path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron')

  assert.ok(existsSync(unpackedDir), `Missing package output: ${unpackedDir}. Run package:${platform}:dir first.`)
  assert.ok(existsSync(engineCliPath), `Missing packaged engine CLI: ${engineCliPath}`)
  assert.ok(existsSync(engineRunnerPath), `Missing packaged engine utility-process runner: ${engineRunnerPath}`)
  assert.ok(existsSync(enginePackageJson), `Missing packaged engine package.json: ${enginePackageJson}`)
  assert.ok(
    existsSync(path.join(resourcesDir, 'engine', 'node_modules', 'better-sqlite3')),
    'Missing packaged engine better-sqlite3 under resources/engine/node_modules',
  )

  const asarUnpackedSqlite = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'better-sqlite3')
  const asarUnpackedPty = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'node-pty')
  assert.ok(existsSync(asarUnpackedSqlite), `Expected asarUnpack for better-sqlite3 at ${asarUnpackedSqlite}`)
  assert.ok(existsSync(asarUnpackedPty), `Expected asarUnpack for node-pty at ${asarUnpackedPty}`)

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `devdesk-${platform}-package-`))
  const repoPath = path.join(tempRoot, 'fixture-repo')
  const dbPath = path.join(tempRoot, 'indexes', 'fixture.sqlite')

  try {
    await mkdir(repoPath, { recursive: true })
    await mkdir(path.dirname(dbPath), { recursive: true })
    await writeFile(path.join(repoPath, 'package-fixture.ts'), "export const packageFixture = 'package-needle'\n")

    const childEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: buildNodePath(resourcesDir),
    }

    const versionResult = await execFileAsync(electronBinaryPath, [engineCliPath, '--version'], {
      env: childEnv,
      shell: process.platform === 'win32' && electronBinaryPath.endsWith('.cmd'),
    })
    assert.match(versionResult.stdout.trim(), /^\d+\.\d+\.\d+/)

    const indexResult = await execFileAsync(
      electronBinaryPath,
      [engineCliPath, 'index', repoPath, '--db', dbPath],
      { env: childEnv, shell: process.platform === 'win32' && electronBinaryPath.endsWith('.cmd') },
    )
    const parsedIndex = JSON.parse(indexResult.stdout)
    assert.equal(parsedIndex.ok, true)

    const searchResult = await execFileAsync(
      electronBinaryPath,
      [engineCliPath, 'search', 'package-needle', '--db', dbPath],
      { env: childEnv, shell: process.platform === 'win32' && electronBinaryPath.endsWith('.cmd') },
    )
    const parsedSearch = JSON.parse(searchResult.stdout)
    assert.equal(parsedSearch.ok, true)
    assert.ok(parsedSearch.results.some((entry) => entry.path.endsWith('package-fixture.ts')))

    const statsResult = await execFileAsync(electronBinaryPath, [engineCliPath, 'stats', '--db', dbPath], {
      env: childEnv,
      shell: process.platform === 'win32' && electronBinaryPath.endsWith('.cmd'),
    })
    const parsedStats = JSON.parse(statsResult.stdout)
    assert.equal(parsedStats.stats.totalFiles, 1)

    // Functional Electron-native SQLite open/query (not layout-only). Resolve the
    // module from the packaged engine explicitly: a temp probe's normal Node
    // lookup can otherwise walk into a developer's parent-level node_modules
    // and validate an unrelated native binary.
    const sqliteProbe = path.join(tempRoot, 'sqlite-probe.cjs')
    await writeFile(
      sqliteProbe,
      `
const Database = require(${JSON.stringify(path.join(resourcesDir, 'engine', 'node_modules', 'better-sqlite3'))});
const db = new Database(':memory:');
const row = db.prepare('select 1 as value').get();
if (!row || row.value !== 1) {
  console.error('sqlite probe failed');
  process.exit(2);
}
db.close();
console.log('sqlite-ok');
`,
    )
    const sqliteResult = await execFileAsync(electronBinaryPath, [sqliteProbe], {
      env: childEnv,
      shell: process.platform === 'win32' && electronBinaryPath.endsWith('.cmd'),
    })
    assert.match(sqliteResult.stdout, /sqlite-ok/)

    // Exercise the same Electron utilityProcess + runner boundary used by the
    // desktop IPC bridge. Direct CLI success alone does not prove this path.
    const utilityElectronPath = path.join(
      repoRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'electron.cmd' : 'electron',
    )
    const utilityEnv = {
      ...process.env,
      NODE_PATH: buildNodePath(resourcesDir),
    }
    delete utilityEnv.ELECTRON_RUN_AS_NODE
    const launcherResult = await execFileAsync(utilityElectronPath, [
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      path.join(repoRoot, 'scripts', 'engine-utility-probe.cjs'),
      engineRunnerPath,
      'stats',
      '--db',
      dbPath,
    ], {
      env: utilityEnv,
      shell: process.platform === 'win32',
      timeout: 30_000,
    })
    const launcherStats = JSON.parse(launcherResult.stdout)
    assert.equal(launcherStats.ok, true)
    assert.equal(launcherStats.stats.totalFiles, 1)

    // PTY: require native binary presence under asarUnpack (functional spawn varies by CI headless).
    // Label: layout+native artifact evidence for node-pty; interactive terminal QA remains manual.
    assert.ok(existsSync(asarUnpackedPty), 'node-pty asarUnpack missing')
    const ptyPackageJson = path.join(asarUnpackedPty, 'package.json')
    assert.ok(existsSync(ptyPackageJson), 'node-pty package.json missing in package')

    console.log(`${platform} package verification passed.`)
    console.log(`  evidence: actual-package + engine-process + engine-fork + electron-native-sqlite`)
    console.log(`  unpacked: ${unpackedDir}`)
    console.log(`  engine: ${engineCliPath}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
