#!/usr/bin/env node
/**
 * Report largest source files by line count (maintainability signal).
 * Used for Phase 0 baselines of the codebase size / modularity plan.
 *
 * Usage:
 *   node scripts/report-file-sizes.mjs
 *   node scripts/report-file-sizes.mjs --top 40 --json
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'release',
  'coverage',
  '.git',
  'target',
  '.next',
  '.turbo',
  'out',
  'build',
])

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.rs',
  '.py',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
])

const IGNORED_FILE_PATTERNS = [
  /\.d\.ts$/i,
  /\.test\.(ts|tsx|js|jsx|mjs)$/i,
  /\.spec\.(ts|tsx|js|jsx|mjs)$/i,
  /package-lock\.json$/i,
]

function parseArgs(argv) {
  let top = 25
  let json = false
  let includeTests = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--top' && argv[i + 1]) {
      top = Math.max(1, Number.parseInt(argv[++i], 10) || 25)
    } else if (arg === '--json') {
      json = true
    } else if (arg === '--include-tests') {
      includeTests = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/report-file-sizes.mjs [--top N] [--json] [--include-tests]`)
      process.exit(0)
    }
  }

  return { top, json, includeTests }
}

function shouldIgnoreFile(filePath, includeTests) {
  const base = path.basename(filePath)
  if (!includeTests && IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(base) || pattern.test(filePath))) {
    return true
  }
  if (base === 'package-lock.json') {
    return true
  }
  return false
}

async function walk(dir, includeTests, acc = []) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return acc
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      // Skip hidden dirs/files except we still may want nothing from them for source report
      if (entry.isDirectory()) continue
    }
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue
      await walk(path.join(dir, entry.name), includeTests, acc)
      continue
    }

    const fullPath = path.join(dir, entry.name)
    const ext = path.extname(entry.name).toLowerCase()
    if (!SOURCE_EXTENSIONS.has(ext)) continue
    if (shouldIgnoreFile(fullPath, includeTests)) continue

    acc.push(fullPath)
  }

  return acc
}

async function countLines(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  if (!text) return 0
  return text.split(/\r?\n/).length
}

async function main() {
  const { top, json, includeTests } = parseArgs(process.argv.slice(2))
  const roots = [
    path.join(repoRoot, 'apps'),
    path.join(repoRoot, 'packages', 'engine', 'src'),
    path.join(repoRoot, 'packages', 'engine', 'rust', 'src'),
    path.join(repoRoot, 'packages', 'ipc-contracts', 'src'),
    path.join(repoRoot, 'scripts'),
  ]

  const files = []
  for (const root of roots) {
    try {
      await fs.access(root)
      await walk(root, includeTests, files)
    } catch {
      // root missing — skip
    }
  }

  const rows = []
  for (const filePath of files) {
    const lines = await countLines(filePath)
    const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/')
    rows.push({ path: rel, lines })
  }

  rows.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))
  const topRows = rows.slice(0, top)
  const over400 = rows.filter((r) => r.lines >= 400).length
  const over800 = rows.filter((r) => r.lines >= 800).length
  const over600 = rows.filter((r) => r.lines >= 600).length

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot: repoRoot.replace(/\\/g, '/'),
    totalSourceFiles: rows.length,
    thresholds: { candidate: 400, soft: 600, p0: 800 },
    counts: {
      atOrOver400: over400,
      atOrOver600: over600,
      atOrOver800: over800,
    },
    top: topRows,
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`Source file size report (${report.totalSourceFiles} files)`)
  console.log(`Generated: ${report.generatedAt}`)
  console.log(
    `>=400: ${over400}  >=600: ${over600}  >=800: ${over800}`,
  )
  console.log('')
  console.log('Top files by line count:')
  for (const row of topRows) {
    const flag = row.lines >= 800 ? ' P0' : row.lines >= 600 ? ' soft' : row.lines >= 400 ? ' warn' : ''
    console.log(`${String(row.lines).padStart(6)}  ${row.path}${flag}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
