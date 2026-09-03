import { describe, expect, it } from 'vitest'
import { buildCustomCommand, formatCmdLiteral, formatPosixShellLiteral, formatPowerShellLiteral } from './shellQuoting'

const hostileValues = [
  { name: 'plain path', value: 'C:\\dev\\my-project' },
  { name: 'spaces', value: 'C:\\My Projects\\app' },
  { name: 'double quotes', value: 'a"&calc".txt' },
  { name: 'single quotes', value: "bob's notes.txt" },
  { name: 'ampersand', value: 'a&calc.txt' },
  { name: 'percent', value: 'a%PATH%.txt' },
  { name: 'command substitution', value: '$(calc).txt' },
  { name: 'backticks', value: 'a`calc`.txt' },
  { name: 'unicode', value: 'Cé沙\\проект' },
]

describe('formatPowerShellLiteral', () => {
  it.each(hostileValues)('wraps $name in a single-quoted literal', ({ value }) => {
    const output = formatPowerShellLiteral(value)
    expect(output.startsWith("'")).toBe(true)
    expect(output.endsWith("'")).toBe(true)
    const inner = output.slice(1, -1)
    expect(inner.split("''").join('')).not.toContain("'")
    expect(output).toContain(value.replaceAll("'", "''"))
  })

  it('neutralizes dollar substitution inside single quotes', () => {
    expect(formatPowerShellLiteral('$(calc).txt')).toBe("'$(calc).txt'")
  })

  it('neutralizes embedded double quotes', () => {
    expect(formatPowerShellLiteral('a"&calc".txt')).toBe("'a\"&calc\".txt'")
  })
})

describe('formatCmdLiteral', () => {
  it.each(hostileValues)('wraps $name in a double-quoted literal', ({ value }) => {
    const output = formatCmdLiteral(value)
    expect(output.startsWith('"')).toBe(true)
    expect(output.endsWith('"')).toBe(true)
    const inner = output.slice(1, -1)
    expect(inner.split('""').join('')).not.toContain('"')
  })

  it('doubles embedded double quotes', () => {
    expect(formatCmdLiteral('a"&calc".txt')).toBe('"a""&calc"".txt"')
  })
})

describe('formatPosixShellLiteral', () => {
  it.each(hostileValues)('wraps $name in a single-quoted literal', ({ value }) => {
    const output = formatPosixShellLiteral(value)
    expect(output.startsWith("'")).toBe(true)
    expect(output.endsWith("'")).toBe(true)
    const inner = output.slice(1, -1)
    expect(inner.split("'\\''").join('')).not.toContain("'")
  })

  it("escapes embedded single quotes with the '\\'' escape", () => {
    expect(formatPosixShellLiteral("bob's notes.txt")).toBe("'bob'\\''s notes.txt'")
  })

  it('keeps command substitution inert inside single quotes', () => {
    expect(formatPosixShellLiteral('$(calc).txt')).toBe("'$(calc).txt'")
  })
})

describe('buildCustomCommand', () => {
  it('wraps a hostile windows path in a cmd-quoted literal', () => {
    const command = buildCustomCommand('code {path}', 'C:\\My Projects\\a"&calc".txt', 'win32')
    expect(command).toBe('code "C:\\My Projects\\a""&calc"".txt"')
  })

  it('wraps a hostile posix path in a single-quoted literal', () => {
    const command = buildCustomCommand('code {path}', '/tmp/x$(calc).txt', 'linux')
    expect(command).toBe("code '/tmp/x$(calc).txt'")
  })

  it('replaces every {path} occurrence', () => {
    const command = buildCustomCommand('{path} --cfg {path}', '/tmp/a b', 'linux')
    expect(command).toBe("'/tmp/a b' --cfg '/tmp/a b'")
  })

  it('appends the quoted path when the template has no {path}', () => {
    expect(buildCustomCommand('code', 'C:\\My Projects', 'win32')).toBe('code "C:\\My Projects"')
    expect(buildCustomCommand('code', '/tmp/a b', 'linux')).toBe("code '/tmp/a b'")
  })
})
