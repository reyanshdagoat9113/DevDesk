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
/** Hard fail for brand-new source files over this size (legacy files use allowlist). */
const hardLimitLoc = 800
const registerIpcHandlerBaseline = 86
/**
 * Legacy files already over the hard limit. Entries may not grow.
 * Format: relative posix path → max allowed lines (baseline at allowlist time).
 */
const legacyLineAllowlist = {
  'apps/desktop/ipc/registerIpc.ts': 3145,
  'apps/renderer/app/App.tsx': 1892,
  'apps/renderer/app/sections/ProjectsSection.tsx': 1557,
  'apps/renderer/app/components/CommandPalette.tsx': 1168,
  'apps/renderer/app/sections/CommandsSection.tsx': 1152,
  'apps/renderer/app/sections/ContainersSection.tsx': 1132,
  'apps/desktop/git/service.ts': 987,
  'apps/renderer/app/components/BugRecorderPanel.tsx': 828,
  'apps/renderer/app/sections/CommandChainsPanel.tsx': 804,
}

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
    const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/')
    const allowMax = legacyLineAllowlist[rel]

    if (rel === 'apps/desktop/ipc/registerIpc.ts') {
      const source = await fs.readFile(filePath, 'utf8')
      const handlerCount = source.match(/ipcMain\.handle\s*\(/g)?.length ?? 0
      if (handlerCount > registerIpcHandlerBaseline) {
        failures.push(
          `registerIpc.ts gained direct handlers (${handlerCount} > ${registerIpcHandlerBaseline}). Add new channels under ipc/handlers instead.`,
        )
      }
    }

    if (allowMax != null) {
      if (lineCount > allowMax) {
        failures.push(
          `Allowlisted file grew past baseline: ${rel} (${lineCount} LOC > ${allowMax}). Extract instead of growing.`,
        )
      } else if (lineCount > softLimitLoc) {
        warnings.push(`Legacy large file (shrinking toward budget): ${rel} (${lineCount} LOC, max ${allowMax})`)
      }
      continue
    }

    if (lineCount > hardLimitLoc) {
      failures.push(
        `New/unallowlisted source file exceeds ${hardLimitLoc} LOC: ${rel} (${lineCount} LOC). Split before merge.`,
      )
    } else if (lineCount > softLimitLoc) {
      warnings.push(`Large source file: ${rel} (${lineCount} LOC)`)
    } else if (lineCount > warningLoc) {
      warnings.push(`Growing source file: ${rel} (${lineCount} LOC)`)
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
