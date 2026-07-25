/**
 * Rebuild native modules for the Electron runtime.
 *
 * Usage:
 *   node scripts/rebuild-native-electron.mjs              # better-sqlite3 only
 *   node scripts/rebuild-native-electron.mjs --with-pty   # better-sqlite3 + node-pty
 *
 * Use --with-pty for app launch / packaging. Smoke tests only need better-sqlite3.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const withPty = process.argv.includes('--with-pty')
const modules = withPty ? 'better-sqlite3,node-pty' : 'better-sqlite3'
const electronRebuildCli = path.join(repoRoot, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js')
const rebuildEnv = { ...process.env }

if (withPty && process.platform === 'win32') {
  // node-pty's winpty gyp file invokes GetCommitHash.bat without a relative path.
  // Windows no longer searches the current directory for commands, so make its
  // bundled helper discoverable while electron-rebuild runs.
  const winptyTools = path.join(repoRoot, 'node_modules', 'node-pty', 'deps', 'winpty', 'src', 'shared')
  const pathValue = [winptyTools, process.env.Path ?? process.env.PATH].filter(Boolean).join(path.delimiter)
  rebuildEnv.Path = pathValue
  rebuildEnv.PATH = pathValue
}

process.stdout.write(`Rebuilding Electron natives: ${modules}\n`)

try {
  execFileSync(process.execPath, [electronRebuildCli, '-f', '-o', modules], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: rebuildEnv,
  })
} catch (error) {
  process.stderr.write(
    [
      '',
      `Failed to rebuild Electron native modules (${modules}).`,
      'Install a C/C++ toolchain matching your platform, then retry:',
      '  Windows: Visual Studio Build Tools with "Desktop development with C++",',
      '           plus Python 3 (used by node-gyp). node-pty may also need Git.',
      '  macOS: Xcode Command Line Tools',
      '  Linux: build-essential, python3',
      '',
      'Tip: rebuild better-sqlite3 alone with `npm run rebuild:native`.',
      '     rebuild terminal support with `npm run rebuild:native:electron`.',
      '',
    ].join('\n'),
  )
  process.exitCode = 1
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    process.exitCode = error.status || 1
  }
}
