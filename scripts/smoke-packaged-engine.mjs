import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execFile } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const engineRootDir = path.join(repoRoot, 'packages', 'engine')
const engineDistDir = path.join(engineRootDir, 'dist')
const enginePackageJsonPath = path.join(engineRootDir, 'package.json')
const appNodeModulesDir = path.join(repoRoot, 'node_modules')
const electronBinaryPath = require('electron')
const builtRuntimePath = path.join(repoRoot, 'dist', 'main', 'engine', 'runtime.js')
const utilityProbePath = path.join(repoRoot, 'scripts', 'engine-utility-probe.cjs')
const engineRequire = createRequire(enginePackageJsonPath)

function resolvePackageRoot(packageName) {
  const entryPath = engineRequire.resolve(packageName)
  let current = path.dirname(entryPath)

  while (true) {
    const packageJsonPath = path.join(current, 'package.json')
    if (existsSync(packageJsonPath)) {
      const packageJson = require(packageJsonPath)
      if (packageJson.name === packageName) {
        return current
      }
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error(`Could not resolve package root for ${packageName}`)
    }
    current = parent
  }
}

async function copyPackageIntoEngine(packageName, packagedEngineDir) {
  const sourceRoot = resolvePackageRoot(packageName)
  const destination = path.join(packagedEngineDir, 'node_modules', packageName)
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(sourceRoot, destination, { recursive: true })
}

async function main() {
  if (!existsSync(builtRuntimePath)) {
    throw new Error(`Build output not found: ${builtRuntimePath}. Run npm run build first.`)
  }

  const runtime = await import(pathToFileURL(builtRuntimePath).href)

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'devdesk-packaged-engine-'))
  const resourcesPath = path.join(tempRoot, 'resources')
  const packagedEngineDir = path.join(resourcesPath, 'engine')
  const repoPath = path.join(tempRoot, 'sample-repo')
  const dbPath = path.join(tempRoot, 'indexes', 'sample.sqlite')

  try {
    await mkdir(resourcesPath, { recursive: true })
    await cp(engineDistDir, packagedEngineDir, { recursive: true })
    await mkdir(path.join(packagedEngineDir, 'node_modules'), { recursive: true })

    // Runtime deps may be hoisted by the monorepo workspace; resolve them and copy.
    await copyPackageIntoEngine('commander', packagedEngineDir)

    // Prefer Electron-rebuilt better-sqlite3 from the app install for packaged smoke.
    await cp(
      path.join(appNodeModulesDir, 'better-sqlite3'),
      path.join(packagedEngineDir, 'node_modules', 'better-sqlite3'),
      { recursive: true },
    )
    await cp(
      path.join(appNodeModulesDir, 'bindings'),
      path.join(packagedEngineDir, 'node_modules', 'bindings'),
      { recursive: true },
    )
    await cp(
      path.join(appNodeModulesDir, 'file-uri-to-path'),
      path.join(packagedEngineDir, 'node_modules', 'file-uri-to-path'),
      { recursive: true },
    )

    await cp(enginePackageJsonPath, path.join(packagedEngineDir, 'package.json'))
    assert.ok(existsSync(path.join(packagedEngineDir, 'node_modules', 'commander')))
    assert.ok(existsSync(path.join(packagedEngineDir, 'node_modules', 'better-sqlite3')))
    await mkdir(repoPath, { recursive: true })
    await mkdir(path.dirname(dbPath), { recursive: true })
    await writeFile(
      path.join(repoPath, 'hello.ts'),
      "export function helloWorld() {\n  return 'hello packaged engine';\n}\n"
    )

    const resolvedBinary = runtime.resolveEngineBinaryPath({
      appPath: path.join(tempRoot, 'app'),
      moduleDirname: path.join(tempRoot, 'app', 'dist', 'main', 'engine'),
      resourcesPath,
      isPackaged: true,
      existsSync,
    })

    assert.equal(
      path.normalize(resolvedBinary),
      path.join(resourcesPath, 'engine', 'cli.js')
    )
    assert.ok(existsSync(path.join(packagedEngineDir, 'runner.js')))

    const childEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    }

    const versionResult = await execFileAsync(electronBinaryPath, [resolvedBinary, '--version'], {
      env: childEnv,
    })

    assert.match(versionResult.stdout.trim(), /^\d+\.\d+\.\d+/)

    const utilityEnv = {
      ...process.env,
      NODE_PATH: path.join(packagedEngineDir, 'node_modules'),
    }
    delete utilityEnv.ELECTRON_RUN_AS_NODE
    if (process.platform === 'linux') {
      utilityEnv.ELECTRON_DISABLE_SANDBOX = '1'
    }
    const utilityPingResult = await execFileAsync(
      electronBinaryPath,
      [utilityProbePath, path.join(packagedEngineDir, 'runner.js'), 'ping'],
      { env: utilityEnv, timeout: 30_000 },
    )
    assert.deepEqual(JSON.parse(utilityPingResult.stdout), { ok: true, version: '0.1.0' })

    const indexResult = await execFileAsync(electronBinaryPath, [
      resolvedBinary,
      'index',
      repoPath,
      '--db',
      dbPath,
    ], {
      env: childEnv,
    })

    const parsedIndex = JSON.parse(indexResult.stdout)
    assert.equal(parsedIndex.ok, true)

    const utilityStatsResult = await execFileAsync(
      electronBinaryPath,
      [utilityProbePath, path.join(packagedEngineDir, 'runner.js'), 'stats', '--db', dbPath],
      { env: utilityEnv, timeout: 30_000 },
    )
    assert.equal(JSON.parse(utilityStatsResult.stdout).stats.totalFiles, 1)

    const searchResult = await execFileAsync(electronBinaryPath, [
      resolvedBinary,
      'search',
      'hello',
      '--db',
      dbPath,
    ], {
      env: childEnv,
    })

    const parsedSearch = JSON.parse(searchResult.stdout)
    assert.equal(parsedSearch.ok, true)
    assert.ok(Array.isArray(parsedSearch.results))
    assert.ok(parsedSearch.results.some((item) => item.path.endsWith('hello.ts')))

    const statsResult = await execFileAsync(electronBinaryPath, [resolvedBinary, 'stats', '--db', dbPath], {
      env: childEnv,
    })
    const parsedStats = JSON.parse(statsResult.stdout)
    assert.equal(parsedStats.stats.totalFiles, 1)

    console.log('Packaged engine smoke test passed.')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
