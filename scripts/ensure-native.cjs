const { execFileSync } = require('node:child_process')

function canLoadBetterSqlite3() {
  try {
    require('better-sqlite3')
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

execFileSync('npm', ['rebuild', 'better-sqlite3'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (!canLoadBetterSqlite3()) {
  process.stderr.write('better-sqlite3 still failed to load after rebuild.\n')
  process.exit(1)
}

process.stdout.write('better-sqlite3 rebuilt successfully.\n')
