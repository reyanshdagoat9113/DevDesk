import {
  Bug,
  Command,
  Container,
  FileDown,
  FolderKanban,
  GitBranch,
  Heart,
  History,
  Monitor,
  PanelTop,
  Search,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

import { screenshots, type ScreenshotId } from './screenshots'

/**
 * Page copy. Everything here is derived from the product's own sources — Readme.md
 * features, apps/renderer/app/lib/appShell.ts navigation, and docs/install.md — so the
 * page cannot claim something the app does not do.
 */

export type FeatureRow = {
  id: ScreenshotId
  eyebrow: string
  title: string
  body: string
  bullets: string[]
  icon: LucideIcon
  /**
   * When false, render copy only (no screenshot). Used when the hero already
   * shows the same capture (Projects).
   */
  showScreenshot?: boolean
}

/**
 * Primary feature rows mirror the app's own navigation. Git lives in SecondaryFeatures
 * (commodity UI). Projects is copy-only because the hero already uses that shot.
 */
/** Commands a user would actually save in the vault — shown in the hero prompt. */
export const vaultCommands = [
  'npm run test:run',
  'npm run rebuild:native:electron',
  'docker start postgres',
  'git status',
]

export const featureRows: FeatureRow[] = [
  {
    id: 'projects',
    eyebrow: 'Projects',
    title: 'Every repository on one shelf',
    body: 'Add your local projects once. DevDesk detects the project type, keeps the ones you pin at the top, and opens the folder, your IDE, or a terminal without hunting through directories.',
    bullets: [
      'Add, pin, and reorder local projects',
      'Open folder, IDE, or terminal in one click',
      'Project type detection and per-project health checks',
    ],
    icon: FolderKanban,
    showScreenshot: false,
  },
  {
    id: 'commands',
    eyebrow: 'Command Vault',
    title: 'Stop re-typing the same commands',
    body: 'Save the commands you actually run, with tags, variables, and presets. Chain them when one step should follow another, and trigger them from the project they belong to.',
    bullets: [
      'Variables and presets instead of copy-paste',
      'Chains for multi-step workflows, with triggers',
      'Tags, pinning, and live run history',
    ],
    icon: Terminal,
  },
  {
    id: 'engine',
    eyebrow: 'Engine',
    title: 'Local code search that stays local',
    body: 'A bundled indexing engine searches your code on your machine. No upload step, no remote index, no waiting on a service — just a local index and ranked results.',
    bullets: [
      'Local index per project, stored in userData',
      'Ranked search results with file and line context',
      'Index stats and git insights',
    ],
    icon: Search,
  },
  {
    id: 'containers',
    eyebrow: 'Containers',
    title: 'Docker controls without the context switch',
    body: 'List, start, stop, and tail logs for your containers next to the project that needs them. Docker missing? The rest of the app carries on working and tells you plainly.',
    bullets: [
      'Start, stop, and inspect containers',
      'Live log tailing',
      'WSL-aware, and graceful when Docker is absent',
    ],
    icon: Container,
  },
  {
    id: 'terminal',
    eyebrow: 'Terminals',
    title: 'Real terminals, in the same window',
    body: 'Embedded terminal tabs sit beside your projects and commands, so running something does not mean leaving the workspace.',
    bullets: [
      'Multiple terminal tabs with resize and search',
      'Fullscreen when you need the room',
      'Launched straight from a project or command',
    ],
    icon: Monitor,
  },
  {
    id: 'history',
    eyebrow: 'History',
    title: 'What ran, when, and what it said',
    body: 'Every run is recorded with its exit status, duration, and output, so a failure from an hour ago is still there when you come back to it.',
    bullets: [
      'Exit status and duration per run',
      'Captured output you can re-read',
      'Filter back to the project or command that produced it',
    ],
    icon: History,
  },
]

export const featureScreenshot = (id: ScreenshotId) => {
  const match = screenshots.find((item) => item.id === id)
  if (!match) throw new Error(`No screenshot registered for feature "${id}"`)
  return match
}

export type SecondaryFeature = {
  title: string
  body: string
  icon: LucideIcon
}

export const secondaryFeatures: SecondaryFeature[] = [
  {
    title: 'Git workspace',
    body: 'Branch, staged and unstaged changes, and per-file diffs for the selected project — enough to know where you left off.',
    icon: GitBranch,
  },
  {
    title: 'Health checks',
    body: 'Project and environment checks with history, so you can see when something started failing.',
    icon: Heart,
  },
  {
    title: 'Bugs with context snapshots',
    body: 'Capture a bug together with the surrounding context and attachments instead of a bare note.',
    icon: Bug,
  },
  {
    title: 'Project notes',
    body: 'Keep the scratch notes for a project attached to the project, not lost in another app.',
    icon: StickyNote,
  },
  {
    title: 'Export and import',
    body: 'Merge or replace your workspace from a file, with a database backup taken first.',
    icon: FileDown,
  },
  {
    title: 'Tray quick actions',
    body: 'Optional tray icon for the handful of actions you want without raising the window.',
    icon: PanelTop,
  },
  {
    title: 'LLM context export',
    body: 'Local helpers that assemble project context for a model, without shipping your code anywhere.',
    icon: Sparkles,
  },
  {
    title: 'Command palette',
    body: 'Cmd/Ctrl+K jumps to any project, command, or view without touching the mouse.',
    icon: Command,
  },
]

export type Step = {
  n: number
  title: string
  body: string
}

export const steps: Step[] = [
  {
    n: 1,
    title: 'Install',
    body: 'Download the installer for your platform and run it. No account, no sign-in, no setup wizard.',
  },
  {
    n: 2,
    title: 'Add your projects',
    body: 'Point DevDesk at the folders you already work in. It detects the project type and indexes on demand.',
  },
  {
    n: 3,
    title: 'Save and run commands',
    body: 'Move the commands living in your shell history into the vault, then run them from the project they belong to.',
  },
]

/** Straight from Readme.md:109-111 — kept as an honesty section, not buried. */
export const nonGoals = [
  'Cloud sync',
  'Team collaboration',
  'Heavy analytics',
  'A full IDE replacement',
]

export type FaqItem = {
  question: string
  answer: string
}

export const faq: FaqItem[] = [
  {
    question: 'Does DevDesk send anything over the network?',
    answer:
      'No. There is no account, no telemetry, and no background daemon. Your projects, commands, run history, and code index stay on your machine. The only network traffic is what your own commands and containers make.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      'In a local SQLite database, devdesk.db, inside the app userData directory — %APPDATA%\\DevDesk on Windows and ~/.config/DevDesk on Linux. Code indexes live alongside it under engine/. You can export or back up the whole thing from inside the app.',
  },
  {
    question: 'Do I need Docker?',
    answer:
      'Only for the container features. DevDesk runs fine without Docker installed and says so instead of failing; Docker Desktop and WSL-hosted Docker are both supported.',
  },
  {
    question: 'Why does Windows warn me about the installer?',
    answer:
      'The 0.1.0 beta installer is unsigned, so SmartScreen shows a warning. Choose More info, then Run anyway. Code signing is on the list for a later release.',
  },
  {
    question: 'Is there a macOS build?',
    answer:
      'Not in this beta. macOS packaging and notarization are deferred; Windows and Linux x64 are the supported targets today.',
  },
  {
    question: 'Does it update itself?',
    answer:
      'No. There is no auto-update channel in the beta — new versions are installed by downloading the next release.',
  },
]
