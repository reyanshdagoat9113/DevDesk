import fs from 'node:fs/promises'
import path from 'node:path'
import fastGlob from 'fast-glob'
import ignore from 'ignore'
import type { BugContextSnapshot, BugReport, HealthCheckItem, ProjectNotes } from '../data/model'
import {
  getBugContextSnapshotByBugId,
  getBugReportById,
  getCommandById,
  getLatestHealthCheckForProject,
  getProjectById,
  getProjectNotesById,
  listBugReports,
  listRecentRunHistoryForProject,
} from '../data/store'

export type LlmBundleSection = 'files' | 'runHistory' | 'health' | 'bugs' | 'notes' | 'engineStats'

export interface LlmBundleOptions {
  sections?: LlmBundleSection[]
  maxTokens?: number
  bugReportId?: string
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface LlmBundleResult {
  markdown: string
  tokenEstimate: number
  includedFiles: string[]
  excludedFiles: string[]
  warnings: string[]
}

const DEFAULT_SECTIONS: LlmBundleSection[] = ['files', 'runHistory', 'health', 'bugs', 'notes', 'engineStats']
const DEFAULT_MAX_TOKENS = 100_000
const CHARS_PER_TOKEN = 4
const MAX_FILE_BYTES = 64 * 1024
const MAX_HEALTH_ITEMS = 8
const MAX_OPEN_BUGS = 10
const MAX_DETECTED_SENSITIVE_PATHS = 8
const MIN_SECTION_ROOM_CHARS = 96
const WALK_IGNORE_PATTERNS = [
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  '.next/**',
  'out/**',
  '.turbo/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  'coverage/**',
  '.nyc_output/**',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
]
const GITIGNORE_BASE_PATTERNS = WALK_IGNORE_PATTERNS.map((pattern) => pattern.replace(/\/\*\*$/, ''))
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
  '.json': 'json',
  '.md': 'md',
  '.mdx': 'mdx',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.sql': 'sql',
  '.xml': 'xml',
  '.dockerfile': 'dockerfile',
}

type MutableBundleState = {
  warnings: string[]
  includedFiles: string[]
  excludedFiles: string[]
}

type FileCollectionResult = {
  markdown: string
}

type RunHistorySummary = {
  markdown: string
}

type HealthSummary = {
  markdown: string
}

type BugSummary = {
  markdown: string
}

type NotesSummary = {
  markdown: string
}

type ProjectMetadataSummary = {
  markdown: string
}

export async function bundleLlmContext(projectId: string, options: LlmBundleOptions = {}): Promise<LlmBundleResult> {
  const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : ''
  if (!normalizedProjectId) {
    throw new Error('Project id is required.')
  }

  const project = await getProjectById(normalizedProjectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const sections = normalizeSections(options.sections)
  const maxTokens = normalizeMaxTokens(options.maxTokens)
  const state: MutableBundleState = {
    warnings: [],
    includedFiles: [],
    excludedFiles: [],
  }

  const parts: string[] = ['# DevDesk LLM Context Bundle']
  appendWithinBudget(parts, buildOverview(project.name, maxTokens, sections, options), maxTokens, state, 'bundle overview')

  const metadata = await collectProjectMetadata(project.path, project.name, project.type)
  appendWithinBudget(parts, metadata.markdown, maxTokens, state, 'project metadata')

  if (sections.includes('runHistory')) {
    const runHistory = await collectRunHistory(project.id)
    appendWithinBudget(parts, runHistory.markdown, maxTokens, state, 'run history')
  }

  if (sections.includes('health')) {
    const health = await collectHealth(project.id)
    appendWithinBudget(parts, health.markdown, maxTokens, state, 'health summary')
  }

  if (sections.includes('bugs')) {
    const bugs = await collectBugs(project.id, options.bugReportId, state)
    appendWithinBudget(parts, bugs.markdown, maxTokens, state, 'bug reports')
  }

  if (sections.includes('notes')) {
    const notes = await collectNotes(project.id)
    appendWithinBudget(parts, notes.markdown, maxTokens, state, 'project notes')
  }

  if (sections.includes('engineStats')) {
    const engineStats = await collectEngineStats(project.id, state)
    appendWithinBudget(parts, engineStats, maxTokens, state, 'engine stats')
  }

  if (sections.includes('files')) {
    const currentMarkdown = joinMarkdown(parts)
    const remainingTokens = Math.max(0, maxTokens - estimateTokens(currentMarkdown))
    if (remainingTokens > 0) {
      const files = await collectProjectFiles(project.path, options, remainingTokens, state)
      appendWithinBudget(parts, files.markdown, maxTokens, state, 'project files')
    } else {
      state.warnings.push('Project files were skipped because the bundle reached the token cap before file collection started.')
    }
  }

  const markdown = joinMarkdown(parts)
  return {
    markdown,
    tokenEstimate: estimateTokens(markdown),
    includedFiles: state.includedFiles,
    excludedFiles: state.excludedFiles,
    warnings: dedupe(state.warnings),
  }
}

function normalizeSections(input?: LlmBundleSection[]): LlmBundleSection[] {
  if (!input?.length) {
    return DEFAULT_SECTIONS
  }

  const allowed = new Set<LlmBundleSection>(DEFAULT_SECTIONS)
  const unique = input.filter((section, index) => allowed.has(section) && input.indexOf(section) === index)
  return unique.length ? unique : DEFAULT_SECTIONS
}

function normalizeMaxTokens(input?: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return DEFAULT_MAX_TOKENS
  }
  return Math.max(1, Math.floor(input))
}

function buildOverview(projectName: string, maxTokens: number, sections: LlmBundleSection[], options: LlmBundleOptions): string {
  return [
    '> Generated by DevDesk LLM Context Bundler.',
    '',
    '## Bundle Settings',
    `- Project: ${projectName}`,
    `- Max tokens: ${maxTokens}`,
    `- Sections: ${sections.join(', ')}`,
    `- Bug report focus: ${options.bugReportId ?? 'none'}`,
    `- Include patterns: ${options.includePatterns?.join(', ') ?? 'default (**/*)'}`,
    `- Exclude patterns: ${options.excludePatterns?.join(', ') ?? 'none'}`,
  ].join('\n')
}

async function collectProjectMetadata(projectPath: string, projectName: string, projectType: string): Promise<ProjectMetadataSummary> {
  const detectedTools = await detectProjectTools(projectPath)
  return {
    markdown: [
      '## Project Metadata',
      `- Name: ${projectName}`,
      `- Path: ${projectPath}`,
      `- Type: ${projectType}`,
      `- Detected tools: ${detectedTools.length ? detectedTools.join(', ') : 'None detected'}`,
    ].join('\n'),
  }
}

async function detectProjectTools(projectPath: string): Promise<string[]> {
  const toolChecks: Array<{ file: string; label: string }> = [
    { file: 'package.json', label: 'package.json' },
    { file: 'pnpm-lock.yaml', label: 'pnpm' },
    { file: 'package-lock.json', label: 'npm' },
    { file: 'yarn.lock', label: 'yarn' },
    { file: 'bun.lockb', label: 'bun' },
    { file: 'docker-compose.yml', label: 'docker-compose' },
    { file: 'docker-compose.yaml', label: 'docker-compose' },
    { file: 'Dockerfile', label: 'docker' },
    { file: 'Cargo.toml', label: 'cargo' },
    { file: 'go.mod', label: 'go' },
    { file: 'pyproject.toml', label: 'pyproject' },
    { file: 'requirements.txt', label: 'pip' },
    { file: '.git', label: 'git' },
  ]

  const results = await Promise.all(toolChecks.map(async ({ file, label }) => {
    try {
      await fs.access(path.join(projectPath, file))
      return label
    } catch {
      return null
    }
  }))

  return dedupe(results.filter((value): value is string => Boolean(value)))
}

async function collectRunHistory(projectId: string): Promise<RunHistorySummary> {
  const entries = await listRecentRunHistoryForProject(projectId, 20)
  if (!entries.length) {
    return { markdown: '## Run History\n_No recent runs found for this project._' }
  }

  const uniqueCommandIds = dedupe(entries.map((entry) => entry.commandId))
  const commands = await Promise.all(uniqueCommandIds.map(async (commandId) => [commandId, await getCommandById(commandId)] as const))
  const commandLookup = new Map(commands.map(([commandId, command]) => [commandId, command?.name ?? commandId]))

  const lines = entries.map((entry, index) => {
    const commandName = commandLookup.get(entry.commandId) ?? entry.commandId
    const details = [
      `status=${entry.status}`,
      `started=${entry.startTime}`,
      entry.endTime ? `ended=${entry.endTime}` : null,
      entry.resolvedCommand ? `resolved=${inlineCode(entry.resolvedCommand)}` : null,
    ].filter(Boolean).join(', ')

    return `${index + 1}. **${escapeMarkdown(commandName)}** (${entry.commandId}) — ${details}`
  })

  return {
    markdown: ['## Run History', ...lines].join('\n'),
  }
}

async function collectHealth(projectId: string): Promise<HealthSummary> {
  const run = await getLatestHealthCheckForProject(projectId)
  if (!run) {
    return { markdown: '## Health Summary\n_No health checks found for this project._' }
  }

  const keyItems = selectKeyHealthItems(run.items)
  const summaryJson = prettifyJson(run.summaryJson)
  const lines = [
    '## Health Summary',
    `- Latest status: ${run.overallStatus}`,
    `- Started: ${run.startedAt}`,
    `- Finished: ${run.finishedAt ?? 'n/a'}`,
    `- Total checks: ${run.items.length}`,
    '',
    '### Key Items',
    ...(keyItems.length
      ? keyItems.map((item) => `- [${item.status}] **${escapeMarkdown(item.label)}** — ${escapeMarkdown(item.message)}`)
      : ['- No health items recorded.']),
    '',
    '### Summary JSON',
    '```json',
    summaryJson,
    '```',
  ]

  return { markdown: lines.join('\n') }
}

function selectKeyHealthItems(items: HealthCheckItem[]): HealthCheckItem[] {
  const nonPassing = items.filter((item) => item.status !== 'pass')
  if (nonPassing.length) {
    return nonPassing.slice(0, MAX_HEALTH_ITEMS)
  }
  return items.slice(0, Math.min(5, items.length))
}

async function collectBugs(projectId: string, bugReportId: string | undefined, state: MutableBundleState): Promise<BugSummary> {
  const lines = ['## Bug Reports']
  let focusedBug: BugReport | null = null

  if (bugReportId?.trim()) {
    focusedBug = await getBugReportById(bugReportId.trim())
    if (!focusedBug) {
      state.warnings.push(`Focused bug report ${bugReportId.trim()} was not found.`)
    } else if (focusedBug.projectId !== projectId) {
      state.warnings.push(`Focused bug report ${bugReportId.trim()} does not belong to this project and was skipped.`)
      focusedBug = null
    }
  }

  if (focusedBug) {
    lines.push('', '### Focused Bug', ...renderBugDetails(focusedBug))
    const snapshot = await getBugContextSnapshotByBugId(focusedBug.id)
    if (snapshot) {
      lines.push('', ...renderBugSnapshot(snapshot))
    }
  }

  const openBugs = (await listBugReports({ projectId, status: 'open' })).slice(0, MAX_OPEN_BUGS)
  lines.push('', '### Open Bugs')
  if (!openBugs.length) {
    lines.push('_No open bugs for this project._')
  } else {
    lines.push(...openBugs.map((bug, index) => `${index + 1}. ${summarizeBug(bug)}`))
  }

  const recentBugs = (await listBugReports({ projectId })).slice(0, 10)
  lines.push('', '### Recent Bugs')
  if (!recentBugs.length) {
    lines.push('_No bug reports found for this project._')
  } else {
    lines.push(...recentBugs.map((bug, index) => `${index + 1}. ${summarizeBug(bug)}`))
  }

  return { markdown: lines.join('\n') }
}

function renderBugDetails(bug: BugReport): string[] {
  return [
    `- ID: ${bug.id}`,
    `- Title: ${escapeMarkdown(bug.title)}`,
    `- Severity: ${bug.severity}`,
    `- Status: ${bug.status}`,
    `- Created: ${bug.createdAt}`,
    `- Updated: ${bug.updatedAt}`,
    bug.expectedResult ? `- Expected: ${escapeMarkdown(bug.expectedResult)}` : null,
    bug.actualResult ? `- Actual: ${escapeMarkdown(bug.actualResult)}` : null,
    bug.reproductionSteps ? `- Reproduction: ${escapeMarkdown(bug.reproductionSteps)}` : null,
    bug.notes ? `- Notes: ${escapeMarkdown(bug.notes)}` : null,
    bug.resolutionNotes ? `- Resolution: ${escapeMarkdown(bug.resolutionNotes)}` : null,
  ].filter((line): line is string => Boolean(line))
}

function renderBugSnapshot(snapshot: BugContextSnapshot): string[] {
  return [
    '### Focused Bug Snapshot',
    '```json',
    JSON.stringify(
      {
        commandHistory: safeJsonParse(snapshot.commandHistoryJson),
        runHistory: safeJsonParse(snapshot.runHistoryJson),
        logs: safeJsonParse(snapshot.logsJson),
        environmentSnapshot: safeJsonParse(snapshot.environmentSnapshotJson),
        activeContainerState: safeJsonParse(snapshot.activeContainerStateJson),
        healthSnapshot: safeJsonParse(snapshot.healthSnapshotJson),
        notesSnippet: safeJsonParse(snapshot.notesSnippetJson),
      },
      null,
      2,
    ),
    '```',
  ]
}

function summarizeBug(bug: BugReport): string {
  return `**${escapeMarkdown(bug.title)}** (${bug.id}) — severity=${bug.severity}, status=${bug.status}, updated=${bug.updatedAt}`
}

async function collectNotes(projectId: string): Promise<NotesSummary> {
  const notes = await getProjectNotesById(projectId)
  if (!hasMeaningfulNotes(notes)) {
    return { markdown: '## Project Notes\n_No saved notes for this project._' }
  }

  return {
    markdown: [
      '## Project Notes',
      '',
      '### Setup Steps',
      toMarkdownText(notes.setupSteps),
      '',
      '### Todos',
      toMarkdownText(notes.todos),
      '',
      '### Reminders',
      toMarkdownText(notes.reminders),
    ].join('\n'),
  }
}

function hasMeaningfulNotes(notes: ProjectNotes): boolean {
  return Boolean(notes.setupSteps.trim() || notes.todos.trim() || notes.reminders.trim())
}

async function collectEngineStats(projectId: string, state: MutableBundleState): Promise<string> {
  const { getProjectStats } = await import('../engine/engineService')
  const stats = await getProjectStats(projectId)
  if (!stats) {
    state.warnings.push('Engine stats were requested but no engine index is available for this project.')
    return '## Engine Stats\n_No engine stats available._'
  }

  const topLanguages = Object.entries(stats.stats.byLanguage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([language, count]) => `- ${language}: ${count}`)

  return [
    '## Engine Stats',
    `- Indexed files: ${stats.stats.totalFiles}`,
    `- Indexed size: ${stats.stats.totalSizeBytes} bytes`,
    `- Indexed at: ${stats.stats.indexedAt}`,
    '',
    '### Top Languages',
    ...(topLanguages.length ? topLanguages : ['- No language stats available.']),
  ].join('\n')
}

async function collectProjectFiles(
  projectPath: string,
  options: LlmBundleOptions,
  remainingTokens: number,
  state: MutableBundleState,
): Promise<FileCollectionResult> {
  const includePatterns = options.includePatterns?.length ? options.includePatterns : ['**/*']
  const gitignoreFilter = await loadGitignore(projectPath)
  const userExcludeFilter = createExcludeFilter(options.excludePatterns)
  const sensitivePaths: string[] = []

  const candidates = await fastGlob(includePatterns, {
    cwd: projectPath,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    unique: true,
    ignore: WALK_IGNORE_PATTERNS,
  })

  const lines = ['## Project Files']
  let remainingChars = remainingTokens * CHARS_PER_TOKEN - estimateJoinedLength(lines)

  for (const candidate of candidates.sort((a, b) => a.localeCompare(b))) {
    const relativePath = candidate.replace(/\\/g, '/')

    if (gitignoreFilter.ignores(relativePath)) {
      state.excludedFiles.push(`${relativePath} — ignored by .gitignore`)
      continue
    }

    if (userExcludeFilter?.ignores(relativePath)) {
      state.excludedFiles.push(`${relativePath} — excluded by caller pattern`)
      continue
    }

    if (matchesSensitivePath(relativePath)) {
      state.excludedFiles.push(`${relativePath} — excluded as sensitive`)
      sensitivePaths.push(relativePath)
      continue
    }

    if (remainingChars <= MIN_SECTION_ROOM_CHARS) {
      state.excludedFiles.push(`${relativePath} — omitted due to token cap`)
      continue
    }

    const absolutePath = path.join(projectPath, candidate)
    let buffer: Buffer
    try {
      buffer = await fs.readFile(absolutePath)
    } catch {
      state.excludedFiles.push(`${relativePath} — unreadable`)
      continue
    }

    if (isProbablyBinary(buffer)) {
      state.excludedFiles.push(`${relativePath} — binary file`)
      continue
    }

    let text = buffer.toString('utf8')
    let truncatedBySize = false
    if (buffer.byteLength > MAX_FILE_BYTES) {
      text = buffer.subarray(0, MAX_FILE_BYTES).toString('utf8')
      truncatedBySize = true
      state.warnings.push(`File ${relativePath} exceeded ${MAX_FILE_BYTES} bytes and was truncated.`)
    }

    const fileBlock = buildFileBlock(relativePath, text)
    if (fileBlock.length > remainingChars) {
      const fitted = fitFileBlock(relativePath, text, remainingChars)
      if (!fitted) {
        state.excludedFiles.push(`${relativePath} — omitted due to token cap`)
        continue
      }
      lines.push(fitted.markdown)
      state.includedFiles.push(relativePath)
      remainingChars -= fitted.markdown.length + 2
      state.warnings.push(`File ${relativePath} was truncated to fit the token cap.`)
      continue
    }

    lines.push(fileBlock)
    state.includedFiles.push(relativePath)
    remainingChars -= fileBlock.length + 2

    if (truncatedBySize) {
      continue
    }
  }

  if (!state.includedFiles.length) {
    lines.push('_No project files were included._')
  }

  if (sensitivePaths.length) {
    state.warnings.push(
      `Sensitive paths were excluded from the bundle: ${sensitivePaths.slice(0, MAX_DETECTED_SENSITIVE_PATHS).join(', ')}${sensitivePaths.length > MAX_DETECTED_SENSITIVE_PATHS ? ', …' : ''}`,
    )
  }

  return {
    markdown: lines.join('\n\n'),
  }
}

function buildFileBlock(relativePath: string, content: string): string {
  const language = detectCodeFenceLanguage(relativePath)
  return [`### File: \`${relativePath}\``, `\`\`\`${language}`, content, '```'].join('\n')
}

function detectCodeFenceLanguage(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase()
  return LANGUAGE_BY_EXTENSION[extension] ?? (path.basename(relativePath).toLowerCase() === 'dockerfile' ? 'dockerfile' : '')
}

function fitFileBlock(relativePath: string, content: string, remainingChars: number): { markdown: string } | null {
  const language = detectCodeFenceLanguage(relativePath)
  const header = `### File: \`${relativePath}\`\n\n`
  const fencePrefix = `\`\`\`${language}\n`
  const footer = '\n```\n\n_Truncated to fit bundle token cap._'
  const fixedChars = header.length + fencePrefix.length + footer.length
  const availableContentChars = remainingChars - fixedChars

  if (availableContentChars <= 0) {
    return null
  }

  const truncatedContent = content.slice(0, availableContentChars)
  return {
    markdown: `${header}${fencePrefix}${truncatedContent}${footer}`,
  }
}

async function loadGitignore(projectRoot: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore()
  ig.add(GITIGNORE_BASE_PATTERNS)

  try {
    const content = await fs.readFile(path.join(projectRoot, '.gitignore'), 'utf8')
    ig.add(content)
  } catch {
    // ignore missing .gitignore
  }

  return ig
}

function createExcludeFilter(patterns?: string[]): ReturnType<typeof ignore> | null {
  if (!patterns?.length) {
    return null
  }

  const normalized = patterns.map((pattern) => pattern.trim()).filter(Boolean)
  if (!normalized.length) {
    return null
  }

  const ig = ignore()
  ig.add(normalized)
  return ig
}

function matchesSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase()
  const basename = path.posix.basename(normalized)

  if (basename === '.env' || basename.startsWith('.env.')) {
    return true
  }

  if (normalized.endsWith('.pem') || normalized.endsWith('.p12') || normalized.endsWith('.pfx') || normalized.endsWith('.key')) {
    return true
  }

  if (['secret', 'token', 'credential', 'apikey', 'api-key', 'privatekey', 'private-key', 'private_key'].some((term) => normalized.includes(term))) {
    return true
  }

  return /(^|[^a-z])key([^a-z]|$)/.test(basename)
}

function appendWithinBudget(parts: string[], markdown: string, maxTokens: number, state: MutableBundleState, label: string) {
  if (!markdown.trim()) {
    return
  }

  const current = joinMarkdown(parts)
  const proposed = current ? `${current}\n\n${markdown}` : markdown
  if (estimateTokens(proposed) <= maxTokens) {
    parts.push(markdown)
    return
  }

  const remainingChars = maxTokens * CHARS_PER_TOKEN - current.length - 2
  if (remainingChars <= MIN_SECTION_ROOM_CHARS) {
    state.warnings.push(`${capitalize(label)} was omitted because the bundle reached the token cap.`)
    return
  }

  const truncated = `${markdown.slice(0, remainingChars - 32)}\n\n_Section truncated to fit bundle token cap._`
  parts.push(truncated)
  state.warnings.push(`${capitalize(label)} was truncated to fit the bundle token cap.`)
}

function joinMarkdown(parts: string[]): string {
  return parts.filter(Boolean).join('\n\n')
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / CHARS_PER_TOKEN)
}

function estimateJoinedLength(parts: string[]): number {
  return joinMarkdown(parts).length
}

function escapeMarkdown(value: string): string {
  return value.replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim()
}

function inlineCode(value: string): string {
  return `\`${value.replace(/`/g, '\\`')}\``
}

function toMarkdownText(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed : '_None._'
}

function prettifyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 1024))
  for (const byte of sample) {
    if (byte === 0) {
      return true
    }
  }
  return false
}
