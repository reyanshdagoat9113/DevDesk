import { describe, expect, it } from 'vitest'

describe('variable detector', () => {
  it('detects simple input variables from command templates', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('echo {{ input }}')
    expect(vars).toEqual([{ name: 'input', required: true }])
  })

  it('detects named input variables', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('deploy {{ input:version }}')
    expect(vars).toEqual([{ name: 'version', required: true, description: 'version' }])
  })

  it('detects named input with default value', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('echo {{ input:message:hello-world }}')
    expect(vars).toEqual([{
      name: 'message',
      default: 'hello-world',
      required: false,
      description: 'message',
    }])
  })

  it('filters out built-in variables (project, env, container)', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables(
      'cd {{ project.path }} && echo {{ input }} && echo {{ env.HOME }}'
    )
    expect(vars).toEqual([{ name: 'input', required: true }])
  })

  it('returns empty array for commands with no variables', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('npm run build')
    expect(vars).toEqual([])
  })

  it('returns empty array for commands with only built-in variables', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('cd {{ project.path }} && docker logs {{ container.name }}')
    expect(vars).toEqual([])
  })

  it('deduplicates duplicate variable references', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('echo {{ input }} and {{ input }} again')
    expect(vars).toEqual([{ name: 'input', required: true }])
  })

  it('returns empty for unknown variable format', async () => {
    const { detectVariables } = await import('./variableDetector')

    const vars = detectVariables('echo {{ unknown.thing }}')
    expect(vars).toEqual([])
  })
})
