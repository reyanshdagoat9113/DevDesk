const { execFileSync } = require('node:child_process')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const npmCli =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

function canLoadBetterSqlite3() {
  try {
    const modulePath = require.resolve('better-sqlite3', { paths: [packageRoot] })
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

if (canLoadBetterSqlite3()) {
  process.stdout.write('better-sqlite3 already matches the current Node runtime.\n')
  process.exit(0)
}

process.stdout.write('Rebuilding better-sqlite3 for the current Node runtime...\n')

try {
  execFileSync(process.execPath, [npmCli, 'rebuild', 'better-sqlite3'], {
    cwd: packageRoot,
    stdio: 'inherit',
  })
} catch {
  process.stderr.write(
    [
      '',
      'Failed to rebuild better-sqlite3 for Node in devdesk-engine.',
      'Install a C/C++ toolchain, then retry:',
      '  Windows: Visual Studio Build Tools with "Desktop development with C++"',
      '  macOS: Xcode Command Line Tools (`xcode-select --install`)',
      '  Linux: build-essential / python3',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

if (!canLoadBetterSqlite3()) {
  process.stderr.write('better-sqlite3 still failed to load after rebuild.\n')
  process.exit(1)
}

process.stdout.write('better-sqlite3 rebuilt successfully.\n')
