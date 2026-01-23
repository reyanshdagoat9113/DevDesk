export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown';
}

export interface Command {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
}

export interface Container {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'paused';
}

