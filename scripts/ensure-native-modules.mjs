/**
 * Ensure better-sqlite3 loads under the current Node runtime for:
 * - the DevDesk app (desktop tests / Node tooling)
 * - every linked/copied devdesk-engine install that ships its own better-sqlite3
 *
 * Does not rebuild Electron-targeted natives (use rebuild:native / rebuild:native:electron).
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const npmCli =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

function uniqueExistingPackageRoots(candidates) {
  const seen = new Set()
  const roots = []

  for (const candidate of candidates) {
    if (!candidate) continue
    let resolved
    try {
      resolved = fs.realpathSync(candidate)
    } catch {
      resolved = path.resolve(candidate)
    }

    if (seen.has(resolved)) continue
    if (!fs.existsSync(path.join(resolved, 'package.json'))) continue
    seen.add(resolved)
    roots.push(resolved)
  }

  return roots
}

function resolveEngineRoots() {
  return uniqueExistingPackageRoots([
    path.join(repoRoot, 'node_modules', 'devdesk-engine'),
    path.join(repoRoot, 'packages', 'engine'),
  ])
}

function canLoadBetterSqlite3(moduleRoot) {
  try {
    const modulePath = require.resolve('better-sqlite3', { paths: [moduleRoot] })
    // Clear require cache so a previous Electron-built load does not mask failure.
    delete require.cache[modulePath]
    const Database = require(modulePath)
    // Opening a DB forces the native addon to load (require alone is not enough).
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

function resolveBetterSqlite3Root(moduleRoot) {
  try {
    const entryPath = require.resolve('better-sqlite3', { paths: [moduleRoot] })
    let current = path.dirname(entryPath)
    while (true) {
      const packageJsonPath = path.join(current, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          if (packageJson.name === 'better-sqlite3') {
            return current
          }
        } catch {
          // keep walking
        }
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  } catch {
    // fall through
  }
  return null
}

function rebuildBetterSqlite3(moduleRoot, label) {
  process.stdout.write(`Rebuilding better-sqlite3 for Node in ${label}...\n`)
  const packageRoot = resolveBetterSqlite3Root(moduleRoot) ?? moduleRoot
  try {
    execFileSync(process.execPath, [npmCli, 'rebuild', 'better-sqlite3'], {
      cwd: packageRoot,
      stdio: 'inherit',
      env: process.env,
    })
  } catch (error) {
    process.stderr.write(
      [
        '',
        `Failed to rebuild better-sqlite3 for Node (${label}).`,
        'Install a C/C++ toolchain, then retry:',
        '  Windows: Visual Studio Build Tools with "Desktop development with C++"',
        '  macOS: Xcode Command Line Tools (`xcode-select --install`)',
        '  Linux: build-essential / python3',
        '',
      ].join('\n'),
    )
    throw error
  }

  if (!canLoadBetterSqlite3(moduleRoot)) {
    throw new Error(`better-sqlite3 still failed to load after rebuild (${label})`)
  }
}

function ensurePackage(moduleRoot, label) {
  if (canLoadBetterSqlite3(moduleRoot)) {
    process.stdout.write(`better-sqlite3 already matches Node runtime (${label}).\n`)
    return
  }

  rebuildBetterSqlite3(moduleRoot, label)
  process.stdout.write(`better-sqlite3 ready for Node (${label}).\n`)
}

function main() {
  ensurePackage(repoRoot, 'devdesk app')

  const engineRoots = resolveEngineRoots()
  if (engineRoots.length === 0) {
    throw new Error(
      'Could not locate devdesk-engine. Expected node_modules/devdesk-engine or packages/engine.',
    )
  }

  for (const engineRoot of engineRoots) {
    const label = path.relative(repoRoot, engineRoot) || engineRoot
    ensurePackage(engineRoot, `devdesk-engine @ ${label}`)
  }
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
