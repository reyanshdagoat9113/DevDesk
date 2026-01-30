import fs from 'node:fs'

import type { ProjectType } from '../data/model'

export function detectProjectType(projectPath: string): ProjectType {
  try {
    const files = fs.readdirSync(projectPath)

    if (files.includes('package.json')) return 'node'
    if (files.includes('pyproject.toml') || files.includes('requirements.txt') || files.includes('setup.py')) {
      return 'python'
    }
    if (files.includes('Cargo.toml')) return 'rust'
    if (files.includes('go.mod')) return 'go'

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export function getProjectIcon(type: ProjectType): string {
  switch (type) {
    case 'node':
      return '⚡'
    case 'python':
      return '🐍'
    case 'rust':
      return '🦀'
    case 'go':
      return '🐹'
    default:
      return '📁'
  }
}
