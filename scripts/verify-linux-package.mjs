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
const releaseDir = path.join(repoRoot, 'release', 'linux-unpacked')
const resourcesDir = path.join(releaseDir, 'resources')
const engineCliPath = path.join(resourcesDir, 'engine', 'cli.js')
const electronBinaryPath = path.join(repoRoot, 'node_modules', '.bin', 'electron')

function buildNodePath() {
  return [
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules'),
    path.join(resourcesDir, 'app.asar', 'node_modules'),
    process.env.NODE_PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter)
}

async function main() {
  assert.ok(existsSync(releaseDir), `Missing package output: ${releaseDir}`)
  assert.ok(existsSync(engineCliPath), `Missing packaged engine CLI: ${engineCliPath}`)

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'devdesk-linux-package-'))
  const repoPath = path.join(tempRoot, 'fixture-repo')
  const dbPath = path.join(tempRoot, 'indexes', 'fixture.sqlite')

  try {
    await mkdir(repoPath, { recursive: true })
    await mkdir(path.dirname(dbPath), { recursive: true })
    await writeFile(path.join(repoPath, 'package-fixture.ts'), "export const packageFixture = 'package-needle'\n")

    const childEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: buildNodePath(),
    }

    const versionResult = await execFileAsync(electronBinaryPath, [engineCliPath, '--version'], {
      env: childEnv,
    })
    assert.match(versionResult.stdout.trim(), /^\d+\.\d+\.\d+/)

    const indexResult = await execFileAsync(electronBinaryPath, [
      engineCliPath,
      'index',
      repoPath,
      '--db',
      dbPath,
    ], {
      env: childEnv,
    })
    const parsedIndex = JSON.parse(indexResult.stdout)
    assert.equal(parsedIndex.ok, true)

    const searchResult = await execFileAsync(electronBinaryPath, [
      engineCliPath,
      'search',
      'package-needle',
      '--db',
      dbPath,
    ], {
      env: childEnv,
    })
    const parsedSearch = JSON.parse(searchResult.stdout)
    assert.equal(parsedSearch.ok, true)
    assert.ok(parsedSearch.results.some((entry) => entry.path.endsWith('package-fixture.ts')))

    const statsResult = await execFileAsync(electronBinaryPath, [engineCliPath, 'stats', '--db', dbPath], {
      env: childEnv,
    })
    const parsedStats = JSON.parse(statsResult.stdout)
    assert.equal(parsedStats.stats.totalFiles, 1)

    console.log('Linux package verification passed.')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
