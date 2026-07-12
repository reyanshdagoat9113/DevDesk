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
const engineRootDir = path.join(repoRoot, '..', 'devdesk-addons', 'devdesk-engine')
const engineDistDir = path.join(engineRootDir, 'dist')
const engineNodeModulesDir = path.join(engineRootDir, 'node_modules')
const enginePackageJsonPath = path.join(engineRootDir, 'package.json')
const appNodeModulesDir = path.join(repoRoot, 'node_modules')
const electronBinaryPath = require('electron')
const builtRuntimePath = path.join(repoRoot, 'dist', 'main', 'engine', 'runtime.js')

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
    await cp(engineNodeModulesDir, path.join(packagedEngineDir, 'node_modules'), { recursive: true })
    await rm(path.join(packagedEngineDir, 'node_modules', 'better-sqlite3'), { recursive: true, force: true })
    await rm(path.join(packagedEngineDir, 'node_modules', 'bindings'), { recursive: true, force: true })
    await rm(path.join(packagedEngineDir, 'node_modules', 'file-uri-to-path'), { recursive: true, force: true })
    await cp(path.join(appNodeModulesDir, 'better-sqlite3'), path.join(packagedEngineDir, 'node_modules', 'better-sqlite3'), { recursive: true })
    await cp(path.join(appNodeModulesDir, 'bindings'), path.join(packagedEngineDir, 'node_modules', 'bindings'), { recursive: true })
    await cp(path.join(appNodeModulesDir, 'file-uri-to-path'), path.join(packagedEngineDir, 'node_modules', 'file-uri-to-path'), { recursive: true })
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

    const childEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    }

    const versionResult = await execFileAsync(electronBinaryPath, [resolvedBinary, '--version'], {
      env: childEnv,
    })

    assert.match(versionResult.stdout.trim(), /^\d+\.\d+\.\d+/)

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
