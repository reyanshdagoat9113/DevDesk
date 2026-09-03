import { describe, expect, it } from 'vitest'
import {
  LINUX_EDITOR_COMMANDS,
  resolveLinuxEditorCandidates,
  resolveLinuxTerminalCandidates,
  spawnFirstSuccessfulLinuxCandidate,
  type LinuxLaunchCandidate,
} from './editorTerminalCommands'

const PATH_WITH_SPACES = '/home/dev/My Projects/dev desk'
const DIR_WITH_SPACES = '/home/dev/My Projects'

const RENDERER_LINUX_EDITOR_IDS = ['vscode', 'cursor', 'webstorm', 'intellij', 'sublime'] as const

const RENDERER_LINUX_TERMINAL_IDS = ['terminal', 'gnome-terminal', 'konsole'] as const

const GENERIC_TERMINAL_CHAIN: Array<{ command: string; args: string[] }> = [
  { command: 'gnome-terminal', args: [`--working-directory=${DIR_WITH_SPACES}`] },
  { command: 'konsole', args: ['--workdir', DIR_WITH_SPACES] },
  { command: 'xfce4-terminal', args: ['--working-directory', DIR_WITH_SPACES] },
  { command: 'x-terminal-emulator', args: ['--working-directory', DIR_WITH_SPACES] },
  { command: 'xdg-terminal', args: [] },
]

function commandsOf(candidates: LinuxLaunchCandidate[]) {
  return candidates.map((candidate) => candidate.command)
}

describe('LINUX_EDITOR_COMMANDS', () => {
  it.each(RENDERER_LINUX_EDITOR_IDS.map((id) => [id] as const))('maps %s to a desktop launcher', (id) => {
    expect(LINUX_EDITOR_COMMANDS[id]).toBeDefined()
    expect(typeof LINUX_EDITOR_COMMANDS[id].command).toBe('string')
    expect(LINUX_EDITOR_COMMANDS[id].command.length).toBeGreaterThan(0)
  })
})

describe('resolveLinuxEditorCandidates', () => {
  it.each([
    ['vscode', 'code'],
    ['cursor', 'cursor'],
    ['webstorm', 'webstorm'],
    ['intellij', 'idea'],
    ['sublime', 'subl'],
  ] as const)('puts the mapped editor %s first with the target path as sole arg', (id, command) => {
    const candidates = resolveLinuxEditorCandidates(id, PATH_WITH_SPACES)

    expect(candidates[0]).toEqual({ command, args: [PATH_WITH_SPACES] })
  })

  it('falls back to xdg-open then code for every known editor id', () => {
    for (const id of RENDERER_LINUX_EDITOR_IDS) {
      expect(commandsOf(resolveLinuxEditorCandidates(id, PATH_WITH_SPACES))).toEqual([LINUX_EDITOR_COMMANDS[id].command, 'xdg-open', 'code'])
    }
  })

  it('returns xdg-open first for an unknown editor id', () => {
    const candidates = resolveLinuxEditorCandidates('emacs', PATH_WITH_SPACES)

    expect(candidates[0]).toEqual({ command: 'xdg-open', args: [PATH_WITH_SPACES] })
    expect(commandsOf(candidates)).toEqual(['xdg-open', 'code'])
  })

  it('returns xdg-open first for an empty editor id', () => {
    expect(commandsOf(resolveLinuxEditorCandidates('', PATH_WITH_SPACES))).toEqual(['xdg-open', 'code'])
  })
})

describe('resolveLinuxTerminalCandidates', () => {
  it.each([
    ['gnome-terminal', { command: 'gnome-terminal', args: [`--working-directory=${DIR_WITH_SPACES}`] }],
    ['konsole', { command: 'konsole', args: ['--workdir', DIR_WITH_SPACES] }],
    ['xfce4-terminal', { command: 'xfce4-terminal', args: ['--working-directory', DIR_WITH_SPACES] }],
  ] as const)('puts the preferred terminal %s first with its cwd flag', (id, expected) => {
    const candidates = resolveLinuxTerminalCandidates(id, DIR_WITH_SPACES)

    expect(candidates[0]).toEqual(expected)
    expect(commandsOf(candidates)).toEqual([
      expected.command,
      'gnome-terminal',
      'konsole',
      'xfce4-terminal',
      'x-terminal-emulator',
      'xdg-terminal',
    ].filter((command, index) => index === 0 || command !== expected.command))
  })

  it('returns the full generic chain for the system default id', () => {
    const candidates = resolveLinuxTerminalCandidates('terminal', DIR_WITH_SPACES)

    expect(candidates).toEqual(GENERIC_TERMINAL_CHAIN)
  })

  it('returns the full generic chain for unknown and empty ids', () => {
    expect(resolveLinuxTerminalCandidates('alacritty', DIR_WITH_SPACES)).toEqual(GENERIC_TERMINAL_CHAIN)
    expect(resolveLinuxTerminalCandidates('', DIR_WITH_SPACES)).toEqual(GENERIC_TERMINAL_CHAIN)
  })

  it('includes x-terminal-emulator and xdg-terminal in the generic chain', () => {
    const commands = commandsOf(resolveLinuxTerminalCandidates('terminal', DIR_WITH_SPACES))

    expect(commands).toContain('x-terminal-emulator')
    expect(commands).toContain('xdg-terminal')
  })

  it('keeps the working directory in every cwd-aware candidate', () => {
    const candidates = resolveLinuxTerminalCandidates('terminal', DIR_WITH_SPACES)

    for (const candidate of candidates) {
      if (candidate.command === 'xdg-terminal') {
        expect(candidate.args).toEqual([])
        continue
      }
      expect(candidate.args.join(' ')).toContain(DIR_WITH_SPACES)
    }
  })

  it.each(RENDERER_LINUX_TERMINAL_IDS.map((id) => [id] as const))('resolves renderer option id %s to at least one candidate', (id) => {
    const candidates = resolveLinuxTerminalCandidates(id, DIR_WITH_SPACES)

    expect(candidates.length).toBeGreaterThan(0)
    expect(commandsOf(candidates)).toContain(candidates[0].command)
  })
})

describe('spawnFirstSuccessfulLinuxCandidate', () => {
  const candidates: LinuxLaunchCandidate[] = [
    { command: 'webstorm', args: [PATH_WITH_SPACES] },
    { command: 'xdg-open', args: [PATH_WITH_SPACES] },
    { command: 'code', args: [PATH_WITH_SPACES] },
  ]

  it('resolves the first successful spawn without trying later candidates', async () => {
    const spawned: string[] = []
    const spawn = async (command: string) => {
      spawned.push(command)
      return command === 'xdg-open' ? { success: true } : { success: false, error: 'spawn failed' }
    }

    const result = await spawnFirstSuccessfulLinuxCandidate(candidates, spawn)

    expect(result).toEqual({ success: true })
    expect(spawned).toEqual(['webstorm', 'xdg-open'])
  })

  it('returns the last error when every candidate fails', async () => {
    const spawned: string[] = []
    const spawn = async (command: string, args: string[]) => {
      spawned.push(`${command} ${args.join(' ')}`)
      return { success: false, error: `cannot run ${command}` }
    }

    const result = await spawnFirstSuccessfulLinuxCandidate(candidates, spawn, 'Failed to open editor.')

    expect(result).toEqual({ success: false, error: 'cannot run code' })
    expect(spawned).toEqual([
      `webstorm ${PATH_WITH_SPACES}`,
      `xdg-open ${PATH_WITH_SPACES}`,
      `code ${PATH_WITH_SPACES}`,
    ])
  })

  it('returns the fallback error when candidates fail without an error message', async () => {
    const spawn = async () => ({ success: false })

    const result = await spawnFirstSuccessfulLinuxCandidate(candidates, spawn, 'Failed to open editor.')

    expect(result).toEqual({ success: false, error: 'Failed to open editor.' })
  })
})
