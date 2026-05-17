import { Container, FolderKanban, History, Search, Terminal } from 'lucide-react'

import type { RunHistoryEntry } from '../types'

export type TabValue = 'projects' | 'commands' | 'engine' | 'containers' | 'history'

export const navItems = [
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'commands', label: 'Commands', icon: Terminal },
  { value: 'engine', label: 'Engine', icon: Search },
  { value: 'containers', label: 'Containers', icon: Container },
  { value: 'history', label: 'History', icon: History },
] as const

export const actionLabels: Partial<Record<TabValue, string>> = {
  projects: 'Add Project',
}

export const GLOBAL_COMMAND_VALUE = '__global__'

export function unwrapIpcErrorMessage(error: unknown, fallbackMessage: string) {
  const raw = error instanceof Error ? error.message : fallbackMessage
  let message = raw.trim()
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
  message = message.replace(/^Error:\s*/i, '')
  return message || fallbackMessage
}

export function toUserContainerError(error: unknown, fallbackMessage: string) {
  const message = unwrapIpcErrorMessage(error, fallbackMessage)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('docker desktop daemon is not running') ||
    normalized.includes('docker daemon') ||
    normalized.includes('failed to connect to the docker api') ||
    normalized.includes('cannot connect to the docker daemon') ||
    normalized.includes('dial unix') ||
    normalized.includes('error during connect')
  ) {
    return 'Docker is not running. Start Docker Desktop (or the Docker daemon) and try again.'
  }

  if (
    normalized.includes('docker cli not found') ||
    normalized.includes('command not found') ||
    normalized.includes('not recognized as an internal or external command')
  ) {
    return 'Docker CLI is not available. Install Docker Desktop and try again.'
  }

  return message
}

export function upsertHistoryEntry(history: RunHistoryEntry[], entry: RunHistoryEntry): RunHistoryEntry[] {
  const existingIndex = history.findIndex((item) => item.id === entry.id)
  if (existingIndex === -1) {
    return [entry, ...history]
  }

  const next = [...history]
  next[existingIndex] = {
    ...next[existingIndex],
    ...entry,
    output: entry.output ?? next[existingIndex].output,
    resolvedCommand: entry.resolvedCommand ?? next[existingIndex].resolvedCommand,
  }
  return next
}
