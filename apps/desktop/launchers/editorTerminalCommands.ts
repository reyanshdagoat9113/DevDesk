export type LinuxLaunchCandidate = {
  command: string
  args: string[]
}

export const LINUX_EDITOR_COMMANDS: Record<string, { command: string; args: (targetPath: string) => string[] }> = {
  vscode: { command: 'code', args: (targetPath) => [targetPath] },
  cursor: { command: 'cursor', args: (targetPath) => [targetPath] },
  webstorm: { command: 'webstorm', args: (targetPath) => [targetPath] },
  intellij: { command: 'idea', args: (targetPath) => [targetPath] },
  sublime: { command: 'subl', args: (targetPath) => [targetPath] },
}

const LINUX_TERMINAL_CANDIDATES: Array<{
  id: string
  command: string
  args: (workingDirectory: string) => string[]
}> = [
  { id: 'gnome-terminal', command: 'gnome-terminal', args: (dir) => [`--working-directory=${dir}`] },
  { id: 'konsole', command: 'konsole', args: (dir) => ['--workdir', dir] },
  { id: 'xfce4-terminal', command: 'xfce4-terminal', args: (dir) => ['--working-directory', dir] },
  { id: 'x-terminal-emulator', command: 'x-terminal-emulator', args: (dir) => ['--working-directory', dir] },
  { id: 'xdg-terminal', command: 'xdg-terminal', args: () => [] },
]

export function resolveLinuxEditorCandidates(preferenceId: string, targetPath: string): LinuxLaunchCandidate[] {
  const candidates: LinuxLaunchCandidate[] = []
  const mapped = LINUX_EDITOR_COMMANDS[preferenceId]
  if (mapped) {
    candidates.push({ command: mapped.command, args: mapped.args(targetPath) })
  }
  candidates.push({ command: 'xdg-open', args: [targetPath] })
  candidates.push({ command: 'code', args: [targetPath] })
  return candidates
}

export function resolveLinuxTerminalCandidates(preferenceId: string, workingDirectory: string): LinuxLaunchCandidate[] {
  const candidates = LINUX_TERMINAL_CANDIDATES.map((candidate) => ({
    command: candidate.command,
    args: candidate.args(workingDirectory),
  }))
  const preferredIndex = LINUX_TERMINAL_CANDIDATES.findIndex((candidate) => candidate.id === preferenceId)
  if (preferredIndex > 0) {
    const [preferred] = candidates.splice(preferredIndex, 1)
    candidates.unshift(preferred)
  }
  return candidates
}

export async function spawnFirstSuccessfulLinuxCandidate(
  candidates: LinuxLaunchCandidate[],
  spawn: (command: string, args: string[]) => Promise<{ success: boolean; error?: string }>,
  fallbackError = 'Failed to launch application.'
) {
  let lastError = fallbackError
  for (const { command, args } of candidates) {
    const result = await spawn(command, args)
    if (result.success) {
      return result
    }
    if (result.error) {
      lastError = result.error
    }
  }
  return { success: false, error: lastError }
}
