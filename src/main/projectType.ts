import fs from 'fs';
import path from 'path';

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown';

const MARKER_FILES: Record<ProjectType, string[]> = {
  node: ['package.json'],
  python: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  rust: ['Cargo.toml'],
  go: ['go.mod', 'go.sum'],
  unknown: [],
};

/**
 * Detect project type from marker files in a directory.
 * Returns 'unknown' if no marker files are found.
 */
export function detectProjectType(projectPath: string): ProjectType {
  if (!fs.existsSync(projectPath)) {
    return 'unknown';
  }

  for (const [type, markers] of Object.entries(MARKER_FILES)) {
    if (type === 'unknown') continue;
    for (const marker of markers) {
      if (fs.existsSync(path.join(projectPath, marker))) {
        return type as ProjectType;
      }
    }
  }

  return 'unknown';
}

/**
 * Get all marker files for a given project type.
 */
export function getMarkerFiles(type: ProjectType): string[] {
  return MARKER_FILES[type] || [];
}
