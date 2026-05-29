import os from 'node:os'

import { app } from 'electron'

import type { BugContextSnapshotData, Container, RunHistoryEntry } from '../data/model'
import { listRecentRunHistoryForProject } from '../data/store/history'
import { getLatestHealthCheckForProject } from '../data/store/health'
import { getProjectNotesById } from '../data/store/notes'

function getAppVersion(): string {
  try {
    if (app.isReady()) {
      return app.getVersion()
    }
  } catch {
    // Not available outside Electron runtime
  }

  return '0.0.0'
}

interface EnvironmentSnapshot {
  nodeVersion: string
  platform: string
  osRelease: string
  hostname: string
  devdeskVersion: string
  capturedAt: string
}

function buildEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    osRelease: os.release(),
    hostname: os.hostname(),
    devdeskVersion: getAppVersion(),
    capturedAt: new Date().toISOString(),
  }
}

export async function captureContextSnapshot(
  projectId: string,
  containers: Container[],
): Promise<BugContextSnapshotData> {
  let runHistory: Array<Omit<RunHistoryEntry, 'output'>> = []
  try {
    runHistory = await listRecentRunHistoryForProject(projectId, 20)
  } catch {
    // Run history is best-effort
  }

  let healthSnapshot: Record<string, unknown> = {}
  try {
    const health = await getLatestHealthCheckForProject(projectId)
    if (health) {
      healthSnapshot = {
        runId: health.id,
        startedAt: health.startedAt,
        finishedAt: health.finishedAt,
        overallStatus: health.overallStatus,
        summary: health.summaryJson ? tryParseJson(health.summaryJson) : {},
      }
    }
  } catch {
    // Health check is optional
  }

  let snippet: { setupSteps?: string; todos?: string } = {}
  try {
    const projectNotes = await getProjectNotesById(projectId)
    if (projectNotes.setupSteps) snippet.setupSteps = projectNotes.setupSteps
    if (projectNotes.todos) snippet.todos = projectNotes.todos
  } catch {
    // Notes are optional
  }

  const activeContainers = containers.filter((c) => c.state === 'running')

  return {
    commandHistoryJson: '[]',
    runHistoryJson: JSON.stringify(runHistory),
    logsJson: '[]',
    environmentSnapshotJson: JSON.stringify(buildEnvironmentSnapshot()),
    activeContainerStateJson: JSON.stringify(activeContainers),
    healthSnapshotJson: JSON.stringify(healthSnapshot),
    notesSnippetJson: JSON.stringify(snippet),
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
