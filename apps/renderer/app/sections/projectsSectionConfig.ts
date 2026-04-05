import type { Container } from '../types'

export const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function isWslPath(projectPath: string) {
  return /^\\\\wsl(?:\.localhost|\$)\\/i.test(projectPath)
}

export const macEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'intellij', label: 'IntelliJ IDEA' },
  { id: 'sublime', label: 'Sublime Text' },
  { id: 'xcode', label: 'Xcode' },
  { id: 'custom', label: 'Custom command' },
]

export const windowsEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'visual-studio', label: 'Visual Studio' },
  { id: 'custom', label: 'Custom command' },
]

export const macTerminalOptions = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'iterm', label: 'iTerm' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: 'warp', label: 'Warp' },
  { id: 'hyper', label: 'Hyper' },
  { id: 'custom', label: 'Custom command' },
]

export const windowsTerminalOptions = [
  { id: 'windows-terminal', label: 'Windows Terminal' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'cmd', label: 'Command Prompt' },
  { id: 'custom', label: 'Custom command' },
]

export const linuxEditorOptions = [
  { id: 'vscode', label: 'Visual Studio Code' },
  { id: 'custom', label: 'Custom command' },
]

export const linuxTerminalOptions = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'custom', label: 'Custom command' },
]

export const containerStateBadge: Record<Container['state'], 'success' | 'warning' | 'outline'> = {
  running: 'success',
  paused: 'warning',
  stopped: 'outline',
}
