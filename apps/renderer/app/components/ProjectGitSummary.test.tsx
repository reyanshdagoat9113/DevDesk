import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectGitSummary } from './ProjectGitSummary'
import type { EngineGitInsights, Project } from '../types'

const project: Project = {
  id: 'project-1',
  name: 'DevDesk',
  path: '/workspace/devdesk',
  type: 'node',
  icon: 'box',
  linkedContainerNames: [],
}

const dirtyInsights: EngineGitInsights = {
  branch: 'main',
  totalCommits: 12,
  contributors: ['Dev Desk'],
  hotspots: [],
  recentCommits: [],
  churnFiles: [],
  workingTree: {
    isClean: false,
    hasStagedChanges: true,
    hasUnstagedChanges: true,
    hasUntrackedChanges: false,
    hasConflicts: false,
    stagedCount: 2,
    unstagedCount: 1,
    untrackedCount: 0,
    conflictedCount: 0,
    ahead: 3,
    behind: 1,
    files: [],
  },
}

describe('ProjectGitSummary', () => {
  it('loads and renders git snapshot details', async () => {
    const onLoadGitInsights = vi.fn(async () => dirtyInsights)
    const onOpenWorkspace = vi.fn()

    render(
      <ProjectGitSummary
        project={project}
        onLoadGitInsights={onLoadGitInsights}
        onOpenWorkspace={onOpenWorkspace}
      />,
    )

    expect(screen.getByText('Loading')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Dirty')).toBeTruthy()
    })

    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByText(/\+3 ahead/)).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpenWorkspace).toHaveBeenCalledWith('project-1')
  })

  it('falls back to unavailable state when insights fail', async () => {
    render(
      <ProjectGitSummary
        project={project}
        onLoadGitInsights={vi.fn(async () => {
          throw new Error('no repo')
        })}
        onOpenWorkspace={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeTruthy()
    })

    expect(screen.getByText('No repo')).toBeTruthy()
    expect(await screen.findByText(/Git details will appear here/)).toBeTruthy()
  })
})
