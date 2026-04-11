import type { Project, Command, Container, RunHistoryEntry } from '../types'

export const mockProjects: Project[] = [
  {
    id: '1',
    path: '/Users/dev/devdesk',
    name: 'devdesk',
    type: 'node',
    icon: '⚡',
    linkedContainerNames: [],
  },
  {
    id: '2',
    path: '/Users/dev/my-api',
    name: 'my-api',
    type: 'node',
    icon: '⚡',
    linkedContainerNames: [],
  },
  {
    id: '3',
    path: '/Users/dev/ml-experiments',
    name: 'ml-experiments',
    type: 'python',
    icon: '🐍',
    linkedContainerNames: [],
  },
  {
    id: '4',
    path: '/Users/dev/rust-cli',
    name: 'rust-cli',
    type: 'rust',
    icon: '🦀',
    linkedContainerNames: [],
  },
]

export const mockCommands: Command[] = [
  {
    id: '1',
    name: 'Docker Cleanup',
    command: 'docker system prune -af --volumes',
    description: 'Remove all unused Docker data',
    tags: ['docker', 'cleanup'],
  },
  {
    id: '2',
    name: 'Git Undo Last Commit',
    command: 'git reset --soft HEAD~1',
    description: 'Undo the last commit but keep changes staged',
    tags: ['git'],
  },
  {
    id: '3',
    name: 'Start Dev Stack',
    command: 'docker-compose up -d {{service}}',
    description: 'Start a specific service in dev mode',
    tags: ['docker', 'dev'],
  },
  {
    id: '4',
    name: 'Run Tests',
    command: 'npm test -- --watch',
    description: 'Run tests in watch mode',
    tags: ['test'],
  },
  {
    id: '5',
    name: 'Lint Fix',
    command: 'npm run lint -- --fix',
    description: 'Run linter and auto-fix issues',
    tags: ['lint'],
  },
]

export const mockContainers: Container[] = [
  {
    id: '1',
    name: 'devdesk-postgres-1',
    image: 'postgres:16-alpine',
    state: 'running',
    ports: ['5432:5432'],
  },
  {
    id: '2',
    name: 'devdesk-redis-1',
    image: 'redis:7-alpine',
    state: 'running',
    ports: ['6379:6379'],
  },
  {
    id: '3',
    name: 'nginx-proxy',
    image: 'nginx:alpine',
    state: 'stopped',
    ports: ['80:80', '443:443'],
  },
  {
    id: '4',
    name: 'ml-experiments-jupyter-1',
    image: 'jupyter/scipy-notebook',
    state: 'running',
    ports: ['8888:8888'],
  },
]

export const mockRunHistory: RunHistoryEntry[] = [
  {
    id: '1',
    commandId: '1',
    projectId: '1',
    status: 'success',
    startTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    endTime: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
    output: 'Deleted:\nContainers: 3\nImages: 5\nCache: 234MB',
  },
  {
    id: '2',
    commandId: '4',
    projectId: '1',
    status: 'running',
    startTime: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '3',
    commandId: '2',
    projectId: '2',
    status: 'success',
    startTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    endTime: new Date(Date.now() - 1000 * 60 * 60 * 2 + 500).toISOString(),
  },
  {
    id: '4',
    commandId: '3',
    projectId: '1',
    status: 'failed',
    startTime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    endTime: new Date(Date.now() - 1000 * 60 * 60 * 3 + 2000).toISOString(),
    output: 'Error: Service "api" not found in docker-compose.yml',
  },
]
