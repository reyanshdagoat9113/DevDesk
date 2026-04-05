import type { CommandPreset, ProjectType } from '../types'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  node: 'Node.js',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  unknown: 'Unknown',
}

export const COMMAND_PRESET_LIBRARY: Record<ProjectType, CommandPreset[]> = {
  node: [
    {
      id: 'node-install',
      name: 'Install',
      command: 'npm install',
      description: 'Install project dependencies with npm.',
      icon: 'package',
      tags: ['node', 'setup'],
    },
    {
      id: 'node-dev',
      name: 'Dev',
      command: 'npm run dev',
      description: 'Start the local development server.',
      icon: 'play',
      tags: ['node', 'dev'],
    },
    {
      id: 'node-build',
      name: 'Build',
      command: 'npm run build',
      description: 'Create a production build for the project.',
      icon: 'hammer',
      tags: ['node', 'build'],
    },
    {
      id: 'node-test',
      name: 'Test',
      command: 'npm test',
      description: 'Run the project test suite.',
      icon: 'check-circle',
      tags: ['node', 'test'],
    },
    {
      id: 'node-lint',
      name: 'Lint',
      command: 'npm run lint',
      description: 'Check the codebase for lint issues.',
      icon: 'alert-circle',
      tags: ['node', 'lint'],
    },
  ],
  python: [
    {
      id: 'python-install',
      name: 'Install',
      command: 'pip install -r requirements.txt',
      description: 'Install Python dependencies from requirements.txt.',
      icon: 'package',
      tags: ['python', 'setup'],
    },
    {
      id: 'python-run',
      name: 'Run',
      command: 'python main.py',
      description: 'Run the default Python entrypoint.',
      icon: 'play',
      tags: ['python', 'run'],
    },
    {
      id: 'python-test',
      name: 'Test',
      command: 'pytest',
      description: 'Execute the project test suite with pytest.',
      icon: 'check-circle',
      tags: ['python', 'test'],
    },
  ],
  rust: [
    {
      id: 'rust-build',
      name: 'Build',
      command: 'cargo build',
      description: 'Compile the Rust project.',
      icon: 'hammer',
      tags: ['rust', 'build'],
    },
    {
      id: 'rust-run',
      name: 'Run',
      command: 'cargo run',
      description: 'Build and run the active Rust binary.',
      icon: 'play',
      tags: ['rust', 'run'],
    },
    {
      id: 'rust-test',
      name: 'Test',
      command: 'cargo test',
      description: 'Run the Rust test suite.',
      icon: 'check-circle',
      tags: ['rust', 'test'],
    },
    {
      id: 'rust-check',
      name: 'Check',
      command: 'cargo check',
      description: 'Validate the codebase without producing binaries.',
      icon: 'alert-circle',
      tags: ['rust', 'check'],
    },
  ],
  go: [
    {
      id: 'go-run',
      name: 'Run',
      command: 'go run .',
      description: 'Run the current Go module.',
      icon: 'play',
      tags: ['go', 'run'],
    },
    {
      id: 'go-build',
      name: 'Build',
      command: 'go build',
      description: 'Compile the Go project.',
      icon: 'hammer',
      tags: ['go', 'build'],
    },
    {
      id: 'go-test',
      name: 'Test',
      command: 'go test ./...',
      description: 'Run all Go tests in the module.',
      icon: 'check-circle',
      tags: ['go', 'test'],
    },
    {
      id: 'go-mod-tidy',
      name: 'Mod Tidy',
      command: 'go mod tidy',
      description: 'Clean up and sync module dependencies.',
      icon: 'wrench',
      tags: ['go', 'deps'],
    },
  ],
  unknown: [],
}

export function getCommandPresetsForProjectType(projectType: ProjectType): CommandPreset[] {
  return COMMAND_PRESET_LIBRARY[projectType] ?? []
}

export function getProjectTypeLabel(projectType: ProjectType): string {
  return PROJECT_TYPE_LABELS[projectType] ?? PROJECT_TYPE_LABELS.unknown
}
