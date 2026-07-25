import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fastGlob from 'fast-glob'
import ignore from 'ignore'
import type { AppPreferences } from '../data/model'

// File entry types
export interface FileEntry {
  name: string
  relativePath: string
  kind: 'file' | 'dir'
}

export interface FileSearchResult {
  relativePath: string
  kind: 'file' | 'dir'
}

export interface ListFilesResult {
  entries: FileEntry[]
  truncated: boolean
}

// Default ignore patterns (always excluded)
const DEFAULT_IGNORE_PATTERNS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  '.turbo',
  '.cache',
  '.vscode',
  '.idea',
  'coverage',
  '.nyc_output',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
]

// Maximum results to return
const MAX_LIST_RESULTS = 2000
const MAX_SEARCH_RESULTS = 100
const MAX_INDEX_SIZE = 200000

// In-memory file index cache per project
interface FileIndex {
  fileList: string[]
  lastIndexedAt: number
  projectPathKey: string
}

const fileIndexCache = new Map<string, FileIndex>()

/**
 * Validates that a relative path does not escape the project root.
 * Returns the resolved absolute path if valid, throws otherwise.
 */
export function resolveProjectPath(projectRoot: string, relativePath?: string): string {
  const normalizedRoot = path.resolve(projectRoot)

  if (!relativePath || relativePath.trim() === '') {
    return normalizedRoot
  }

  const raw = relativePath.trim()

  // Reject absolute paths (including UNC) early.
  if (path.isAbsolute(raw)) {
    throw new Error('Absolute paths are not allowed.')
  }

  // On Windows, also reject drive-qualified or UNC-like inputs that may not be caught by isAbsolute.
  if (process.platform === 'win32') {
    if (/^[a-zA-Z]:/.test(raw)) {
      throw new Error('Drive-qualified paths are not allowed.')
    }
    if (raw.startsWith('\\') || raw.startsWith('//')) {
      throw new Error('UNC paths are not allowed.')
    }
  }

  const resolved = path.resolve(normalizedRoot, raw)
  const rel = path.relative(normalizedRoot, resolved)

  // If rel starts with ".." (or is ".."), the resolved path escaped the root.
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('Path is outside the project boundary.')
  }

  return resolved
}

/**
 * Load .gitignore from project root and return ignore filter
 */
async function loadGitignore(projectRoot: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore()

  // Always add default ignores
  ig.add(DEFAULT_IGNORE_PATTERNS)

  // Try to load .gitignore
  const gitignorePath = path.join(projectRoot, '.gitignore')
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8')
    ig.add(content)
  } catch {
    // .gitignore doesn't exist or can't be read - that's fine
  }

  return ig
}

/**
 * List files and directories in a project folder
 */
export async function listProjectFiles(
  projectRoot: string,
  dir?: string
): Promise<ListFilesResult> {
  const targetPath = resolveProjectPath(projectRoot, dir)

  // Verify path exists and is a directory
  let stats: { isDirectory(): boolean }
  try {
    stats = await fs.stat(targetPath)
  } catch {
    return { entries: [], truncated: false }
  }

  if (!stats.isDirectory()) {
    return { entries: [], truncated: false }
  }

  // Load ignore patterns
  const ig = await loadGitignore(projectRoot)

  // Read directory entries
  const entries = await fs.readdir(targetPath, { withFileTypes: true })

  // Filter and map entries
  const fileEntries: FileEntry[] = []
  for (const entry of entries) {
    const relativeToRoot = dir
      ? path.posix.join(dir.replace(/\\/g, '/'), entry.name)
      : entry.name

    // Skip ignored entries
    if (ig.ignores(relativeToRoot)) {
      continue
    }

    fileEntries.push({
      name: entry.name,
      relativePath: relativeToRoot,
      kind: entry.isDirectory() ? 'dir' : 'file',
    })
  }

  // Sort: directories first, then alphabetically
  fileEntries.sort((a, b) => {
    if (a.kind === 'dir' && b.kind === 'file') return -1
    if (a.kind === 'file' && b.kind === 'dir') return 1
    return a.name.localeCompare(b.name)
  })

  // Apply cap
  const truncated = fileEntries.length > MAX_LIST_RESULTS
  const resultEntries = truncated ? fileEntries.slice(0, MAX_LIST_RESULTS) : fileEntries

  return { entries: resultEntries, truncated }
}

/**
 * Build or get cached file index for a project
 */
async function getFileIndex(projectId: string, projectRoot: string): Promise<FileIndex> {
  const pathKey = path.resolve(projectRoot).toLowerCase()
  const cached = fileIndexCache.get(projectId)

  if (cached && cached.projectPathKey === pathKey) {
    return cached
  }

  // Build new index
  const ig = await loadGitignore(projectRoot)

  // Use fast-glob to get all files
  const entries = await fastGlob('**/*', {
    cwd: projectRoot,
    dot: true,
    onlyFiles: false,
    markDirectories: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: DEFAULT_IGNORE_PATTERNS,
  })

  // Filter using gitignore
  const filteredEntries = entries.filter(entry => {
    // Remove trailing slash for directories (added by markDirectories)
    const cleanEntry = entry.endsWith('/') ? entry.slice(0, -1) : entry
    return !ig.ignores(cleanEntry)
  })

  // Check if we exceeded max
  const fileList = filteredEntries.slice(0, MAX_INDEX_SIZE)

  const index: FileIndex = {
    fileList,
    lastIndexedAt: Date.now(),
    projectPathKey: pathKey,
  }

  fileIndexCache.set(projectId, index)
  return index
}

/**
 * Simple fuzzy search implementation
 */
function fuzzySearch(query: string, items: string[]): Array<{ item: string; score: number }> {
  const lowerQuery = query.toLowerCase()
  const queryChars = lowerQuery.split('')

  const results: Array<{ item: string; score: number }> = []

  for (const item of items) {
    const lowerItem = item.toLowerCase()
    let score = 0
    let lastIndex = 0
    let matches = 0

    for (const char of queryChars) {
      const index = lowerItem.indexOf(char, lastIndex)
      if (index === -1) {
        // Character not found - skip this item
        matches = -1
        break
      }
      // Bonus for consecutive matches
      if (index === lastIndex) {
        score += 2
      } else {
        score += 1
      }
      lastIndex = index + 1
      matches++
    }

    if (matches === queryChars.length) {
      // Bonus for exact substring match
      if (lowerItem.includes(lowerQuery)) {
        score += 10
        // Bonus for matching at start or after separator
        if (lowerItem.startsWith(lowerQuery)) {
          score += 5
        }
      }
      results.push({ item, score })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * Search files in a project by path/name
 */
export async function searchProjectFiles(
  projectId: string,
  projectRoot: string,
  query: string,
  limit: number = MAX_SEARCH_RESULTS
): Promise<FileSearchResult[]> {
  if (!query || query.trim() === '') {
    return []
  }

  // Get or build index
  const index = await getFileIndex(projectId, projectRoot)

  // Perform fuzzy search
  const searchResults = fuzzySearch(query.trim(), index.fileList)

  // Apply limit and map to results
  const cappedResults = searchResults.slice(0, Math.min(limit, MAX_SEARCH_RESULTS))

  return cappedResults.map(result => ({
    relativePath: result.item,
    kind: result.item.endsWith('/') ? 'dir' : 'file',
  }))
}

/**
 * Clear the file index cache for a project (call when project changes)
 */
export function clearFileIndex(projectId: string): void {
  fileIndexCache.delete(projectId)
}

/**
 * Rebuild the file index for a project
 */
export async function rebuildFileIndex(projectId: string, projectRoot: string): Promise<void> {
  fileIndexCache.delete(projectId)
  await getFileIndex(projectId, projectRoot)
}

// Editor command mappings
const MAC_EDITOR_APPS: Record<string, string> = {
  vscode: 'Visual Studio Code',
  cursor: 'Cursor',
  webstorm: 'WebStorm',
  intellij: 'IntelliJ IDEA',
  sublime: 'Sublime Text',
  xcode: 'Xcode',
}

const WINDOWS_EDITOR_COMMANDS: Record<string, { command: string; buildArgs: (filePath: string, line?: number, column?: number) => string[] }> = {
  vscode: {
    command: 'code',
    buildArgs: (filePath, line, column) => {
      if (line !== undefined) {
        const location = column !== undefined ? `${filePath}:${line}:${column}` : `${filePath}:${line}`
        return ['--goto', location]
      }
      return [filePath]
    },
  },
  'visual-studio': {
    command: 'devenv',
    buildArgs: (filePath) => ['/edit', filePath],
  },
}

function spawnDetached(command: string, args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.on('error', (error) => resolve({ success: false, error: error.message }))
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    } catch (error) {
      resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to start process.' })
    }
  })
}

function spawnShellDetached(command: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true,
      })
      child.on('error', (error) => resolve({ success: false, error: error.message }))
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    } catch (error) {
      resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to start process.' })
    }
  })
}

// Parse WSL UNC path
const WSL_UNC_PATH_PATTERN = /^\\\\wsl(?:\.localhost|\$)\\([^\\/]+)(?:[\\/](.*))?$/i

function parseWslProjectPath(projectPath: string): { distro: string; linuxPath: string } | null {
  if (process.platform !== 'win32') {
    return null
  }

  const normalized = path.win32.normalize(projectPath.trim())
  const match = normalized.match(WSL_UNC_PATH_PATTERN)
  if (!match) {
    return null
  }

  const distro = match[1]
  const relativePart = match[2]
  const segments = relativePart
    ? relativePart
      .split(/[\\/]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
    : []

  const linuxPath = segments.length ? `/${segments.join('/')}` : '/'

  return { distro, linuxPath }
}

/**
 * Open a file in the configured editor
 */
export async function openFileInEditor(
  projectRoot: string,
  relativePath: string,
  preferences: AppPreferences,
  line?: number,
  column?: number
): Promise<{ success: boolean; error?: string }> {
  const filePath = resolveProjectPath(projectRoot, relativePath)

  // Verify file exists
  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      return { success: false, error: 'Path is not a file.' }
    }
  } catch {
    return { success: false, error: 'File not found.' }
  }

  const preference = preferences.editor

  // Handle custom command
  if (preference.id === 'custom') {
    if (!preference.command) {
      return { success: false, error: 'Custom command is required.' }
    }
    // Replace {path} placeholder with actual file path
    // Support line/column placeholders too: {line}, {column}
    let command = preference.command
    if (command.includes('{path}')) {
      command = command.replace(/\{path\}/g, `"${filePath}"`)
    } else {
      command = `${command} "${filePath}"`
    }
    if (line !== undefined) {
      command = command.replace(/\{line\}/g, String(line))
    }
    if (column !== undefined) {
      command = command.replace(/\{column\}/g, String(column))
    }
    return spawnShellDetached(command)
  }

  const wslLocation = parseWslProjectPath(projectRoot)

  if (process.platform === 'darwin') {
    const appName = MAC_EDITOR_APPS[preference.id] ?? MAC_EDITOR_APPS.vscode
    return spawnDetached('open', ['-a', appName, filePath])
  }

  if (process.platform === 'win32') {
    // Handle VS Code with WSL
    if (wslLocation && preference.id === 'vscode') {
      const relativeFilePath = relativePath.replace(/\\/g, '/')
      const fullLinuxPath = path.posix.join(wslLocation.linuxPath, relativeFilePath)

      const args: string[] = ['--remote', `wsl+${wslLocation.distro}`]
      if (line !== undefined) {
        const location = column !== undefined ? `${fullLinuxPath}:${line}:${column}` : `${fullLinuxPath}:${line}`
        args.push('--goto', location)
      } else {
        args.push(fullLinuxPath)
      }

      const result = await spawnDetached('code', args)
      if (result.success) {
        return result
      }
      // Fallback to regular path opening
      const command = WINDOWS_EDITOR_COMMANDS[preference.id] ?? WINDOWS_EDITOR_COMMANDS.vscode
      return spawnDetached(command.command, command.buildArgs(filePath, line, column))
    }

    const command = WINDOWS_EDITOR_COMMANDS[preference.id] ?? WINDOWS_EDITOR_COMMANDS.vscode
    return spawnDetached(command.command, command.buildArgs(filePath, line, column))
  }

  // Linux fallback
  return spawnDetached('code', [filePath])
}
