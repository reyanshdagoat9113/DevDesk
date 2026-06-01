import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LlmContextExporter } from './LlmContextExporter'
import type { Project } from '../types'

const project: Project = {
  id: 'project-1',
  name: 'Demo App',
  path: '/tmp/demo-app',
  type: 'node',
  icon: 'package',
  linkedContainerNames: [],
}

describe('LlmContextExporter', () => {
  it('renders a live bundle preview and token usage details', async () => {
    const bundleContext = vi.fn().mockResolvedValue({
      markdown: '# Demo bundle\n\n## Project Metadata\n- Name: Demo App',
      tokenEstimate: 32100,
      includedFiles: ['src/index.ts'],
      excludedFiles: ['.env — excluded as sensitive'],
      warnings: ['Sensitive paths were excluded from the bundle: .env'],
    })

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        llm: { bundleContext },
      },
    })

    render(<LlmContextExporter project={project} />)

    await waitFor(() => {
      expect(bundleContext).toHaveBeenCalled()
    })

    expect(screen.getByText('32,100')).toBeTruthy()
    expect(screen.getByText(/src\/index.ts/)).toBeTruthy()
    expect(screen.getByText(/Sensitive paths were excluded/)).toBeTruthy()
    expect(screen.getByText((content) => content.includes('32% of') && content.includes('token cap'))).toBeTruthy()
  })

  it('shows an error when all sections are cleared', async () => {
    const bundleContext = vi.fn().mockResolvedValue({
      markdown: '# Demo bundle',
      tokenEstimate: 100,
      includedFiles: [],
      excludedFiles: [],
      warnings: [],
    })

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        llm: { bundleContext },
      },
    })

    const user = userEvent.setup()

    render(<LlmContextExporter project={project} />)

    await waitFor(() => expect(bundleContext).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Clear all' }))

    await waitFor(() => {
      expect(screen.getByText(/Select at least one section/)).toBeTruthy()
    })
    expect(bundleContext).toHaveBeenCalledTimes(1)
  })
})
