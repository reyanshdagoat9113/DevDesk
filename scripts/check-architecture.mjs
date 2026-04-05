import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const roots = [
  path.join(repoRoot, 'apps', 'desktop'),
  path.join(repoRoot, 'apps', 'renderer', 'app'),
]
const ignoredSegments = new Set(['dist', 'node_modules'])
const ignoredNames = new Set([
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'pnpm-lock.yaml',
  'yarn.lock',
])
const ignoredFilePatterns = [/\.d\.ts$/i, /\.test\.(ts|tsx|js|jsx)$/i, /\.spec\.(ts|tsx|js|jsx)$/i]
const genericNames = new Set(['helpers.ts', 'helpers.tsx', 'misc.ts', 'misc.tsx', 'temp.ts', 'temp.tsx'])
const warningLoc = 400
const softLimitLoc = 600

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (ignoredSegments.has(entry.name)) {
        continue
      }
      if (dir.endsWith(path.join('components')) && entry.name === 'ui') {
        continue
      }
      files.push(...await walk(fullPath))
      continue
    }

    files.push(fullPath)
  }

  return files
}

function shouldIgnoreFile(filePath) {
  const base = path.basename(filePath)
  if (ignoredNames.has(base)) {
    return true
  }

  return ignoredFilePatterns.some((pattern) => pattern.test(base))
}

async function countLines(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  if (!text) {
    return 0
  }
  return text.split(/\r?\n/).length
}

function parentKey(filePath) {
  return path.dirname(filePath)
}

async function main() {
  const files = []
  for (const root of roots) {
    files.push(...await walk(root))
  }

  const sourceFiles = files.filter((filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    return ['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext) && !shouldIgnoreFile(filePath)
  })

  const warnings = []
  const failures = []
  const siblingCounts = new Map()

  for (const filePath of sourceFiles) {
    const base = path.basename(filePath).toLowerCase()
    siblingCounts.set(parentKey(filePath), (siblingCounts.get(parentKey(filePath)) ?? 0) + 1)

    if (genericNames.has(base)) {
      failures.push(`Generic filename not allowed: ${path.relative(repoRoot, filePath)}`)
    }
  }

  for (const filePath of sourceFiles) {
    const lineCount = await countLines(filePath)
    if (lineCount > softLimitLoc) {
      warnings.push(`Large source file: ${path.relative(repoRoot, filePath)} (${lineCount} LOC)`)
    } else if (lineCount > warningLoc) {
      warnings.push(`Growing source file: ${path.relative(repoRoot, filePath)} (${lineCount} LOC)`)
    }
  }

  for (const [dirPath, count] of siblingCounts.entries()) {
    if (count > 8) {
      warnings.push(`Dense folder: ${path.relative(repoRoot, dirPath)} has ${count} source siblings`)
    }
  }

  for (const warning of warnings) {
    console.warn(warning)
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(failure)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
