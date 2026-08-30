import { describe, expect, it } from 'vitest'
import type { Project, Container } from '../data/model'

const mockProject: Project = {
  id: 'p1',
  path: '/workspace/my-app',
  name: 'My App',
  type: 'node',
  icon: 'box',
  linkedContainerNames: [],
}

const mockContainers: Container[] = [
  {
    id: 'c1',
    name: 'my-db',
    image: 'postgres:16',
    state: 'running',
    ports: ['5432:5432'],
  },
  {
    id: 'c2',
    name: 'my-redis',
    image: 'redis:7',
    state: 'running',
    ports: ['6379:6379'],
  },
]

const mockEnv = {
  HOME: '/home/user',
  USER: 'dev',
  NODE_ENV: 'development',
}

describe('variable resolver', () => {
  it('extracts variable names from command templates', async () => {
    const { variableResolver } = await import('./variableResolver')

    const vars1 = variableResolver.extractVariables('echo {{ input }}')
    expect(vars1).toEqual(['input'])

    const vars2 = variableResolver.extractVariables('deploy {{ input:version }} to {{ env.HOME }}')
    expect(vars2).toContain('input:version')
    expect(vars2).toContain('env.HOME')

    const vars3 = variableResolver.extractVariables('no variables here')
    expect(vars3).toEqual([])
  })

  it('resolves project variables', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'cd {{ project.path }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe("cd '/workspace/my-app'")
    expect(result.resolvedValues['project.path']).toBe("'/workspace/my-app'")
    expect(result.unresolvedInputs).toEqual([])
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves project.name and project.type', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ project.name }} is {{ project.type }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe("echo 'My App' is 'node'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves environment variables', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ env.USER }} in {{ env.NODE_ENV }}',
      { project: mockProject, containers: [], env: mockEnv }
    )

    expect(result.resolvedCommand).toBe("echo 'dev' in 'development'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('leaves unknown env vars as unresolved placeholders', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ env.MISSING }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe('echo {{ env.MISSING }}')
    expect(result.unresolvedVariables).toEqual(['env.MISSING'])
  })

  it('resolves container.name to first container', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'docker logs {{ container.name }}',
      { project: mockProject, containers: mockContainers, env: {} }
    )

    expect(result.resolvedCommand).toBe("docker logs 'my-db'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves container.names to space-joined names', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'docker restart {{ container.names }}',
      { project: mockProject, containers: mockContainers, env: {} }
    )

    expect(result.resolvedCommand).toBe("docker restart 'my-db my-redis'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('handles empty container list gracefully', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ container.name }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe('echo {{ container.name }}')
    expect(result.unresolvedVariables).toEqual(['container.name'])
  })

  it('returns input-required for simple {{input}}', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe('echo {{ input }}')
    expect(result.unresolvedInputs).toEqual([
      { name: 'input', required: true, description: 'Input required' },
    ])
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves {{input}} when user input provided', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }}',
      { project: mockProject, containers: [], env: {} },
      { input: 'hello' }
    )

    expect(result.resolvedCommand).toBe("echo 'hello'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('returns input-required for {{input:description}}', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input:version }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.unresolvedInputs).toEqual([
      { name: 'version', required: true, description: 'version' },
    ])
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves {{input:name}} when user input provided', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input:version }}',
      { project: mockProject, containers: [], env: {} },
      { version: '2.0.0' }
    )

    expect(result.resolvedCommand).toBe("echo '2.0.0'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('returns input-required for {{input:name:default}} with default', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input:message:hello-world }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.unresolvedInputs).toEqual([
      { name: 'message', required: false, default: 'hello-world', description: 'message' },
    ])
    expect(result.unresolvedVariables).toEqual([])
  })

  it('resolves {{input:name:default}} when user provides input', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input:message:hello-world }}',
      { project: mockProject, containers: [], env: {} },
      { message: 'custom value' }
    )

    expect(result.resolvedCommand).toBe("echo 'custom value'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('escapes posix shell values with single quotes', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }}',
      { project: mockProject, containers: [], env: {} },
      { input: "it's working" }
    )

    expect(result.resolvedCommand).toBe("echo 'it'\\''s working'")
    expect(result.unresolvedVariables).toEqual([])
  })

  it('escapes windows shell values with double quotes', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }}',
      { project: mockProject, containers: [], env: {} },
      { input: 'some "value"' },
      'windows'
    )

    expect(result.resolvedCommand).toBe('echo "some \\"value\\""')
    expect(result.unresolvedVariables).toEqual([])
  })

  it('tracks resolved values for history', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      '{{ project.name }} - {{ env.USER }} - {{ input:version }}',
      { project: mockProject, containers: [], env: mockEnv },
      { version: '1.0' }
    )

    expect(result.resolvedValues).toEqual({
      'project.name': "'My App'",
      'env.USER': "'dev'",
      'input:version': "'1.0'",
    })
    expect(result.unresolvedVariables).toEqual([])
  })

  it('reports unknown project fields as unresolved variables', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ project.wrongfield }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.resolvedCommand).toBe('echo {{ project.wrongfield }}')
    expect(result.unresolvedVariables).toEqual(['project.wrongfield'])
    expect(result.unresolvedInputs).toEqual([])
  })

  it('reports unknown container fields as unresolved variables', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'docker logs {{ container.nope }}',
      { project: mockProject, containers: mockContainers, env: {} }
    )

    expect(result.resolvedCommand).toBe('docker logs {{ container.nope }}')
    expect(result.unresolvedVariables).toEqual(['container.nope'])
    expect(result.unresolvedInputs).toEqual([])
  })

  it('lists only unknown env vars when mixed with resolved env', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ env.USER }} {{ env.MISSING }}',
      { project: mockProject, containers: [], env: mockEnv }
    )

    expect(result.resolvedCommand).toBe("echo 'dev' {{ env.MISSING }}")
    expect(result.unresolvedVariables).toEqual(['env.MISSING'])
    expect(result.resolvedValues['env.USER']).toBe("'dev'")
  })

  it('keeps {{input}} in unresolvedInputs without listing it as unknown', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.unresolvedVariables).toEqual([])
    expect(result.unresolvedInputs).toEqual([
      { name: 'input', required: true, description: 'Input required' },
    ])
  })

  it('fills both collections when input and unknown env are present', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ input }} {{ env.MISSING }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.unresolvedInputs).toEqual([
      { name: 'input', required: true, description: 'Input required' },
    ])
    expect(result.unresolvedVariables).toEqual(['env.MISSING'])
    expect(result.resolvedCommand).toBe('echo {{ input }} {{ env.MISSING }}')
  })

  it('keeps unresolved variables unique in first-seen order', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ env.MISSING }} {{ project.nope }} {{ env.MISSING }}',
      { project: mockProject, containers: [], env: {} }
    )

    expect(result.unresolvedVariables).toEqual(['env.MISSING', 'project.nope'])
  })

  it('treats empty env values as resolved', async () => {
    const { variableResolver } = await import('./variableResolver')

    const result = variableResolver.resolve(
      'echo {{ env.EMPTY }}',
      { project: mockProject, containers: [], env: { EMPTY: '' } }
    )

    expect(result.resolvedCommand).toBe("echo ''")
    expect(result.unresolvedVariables).toEqual([])
  })
})

describe('assertCommandVariablesResolved', () => {
  it('throws listing a single unknown variable', async () => {
    const { assertCommandVariablesResolved } = await import('./variableResolver')

    expect(() =>
      assertCommandVariablesResolved({
        resolvedCommand: 'echo {{ env.MISSING }}',
        unresolvedInputs: [],
        resolvedValues: {},
        unresolvedVariables: ['env.MISSING'],
      })
    ).toThrow('Unknown variable: env.MISSING')
  })

  it('throws listing several unknown variables', async () => {
    const { assertCommandVariablesResolved } = await import('./variableResolver')

    expect(() =>
      assertCommandVariablesResolved({
        resolvedCommand: 'echo {{ env.MISSING }} {{ project.nope }}',
        unresolvedInputs: [],
        resolvedValues: {},
        unresolvedVariables: ['env.MISSING', 'project.nope'],
      })
    ).toThrow('Unknown variables: env.MISSING, project.nope')
  })

  it('does not throw when only unresolvedInputs exist', async () => {
    const { assertCommandVariablesResolved } = await import('./variableResolver')

    expect(() =>
      assertCommandVariablesResolved({
        resolvedCommand: 'echo {{ input }}',
        unresolvedInputs: [{ name: 'input', required: true, description: 'Input required' }],
        resolvedValues: {},
        unresolvedVariables: [],
      })
    ).not.toThrow()
  })

  it('does not throw when everything resolved', async () => {
    const { assertCommandVariablesResolved } = await import('./variableResolver')

    expect(() =>
      assertCommandVariablesResolved({
        resolvedCommand: "echo 'dev'",
        unresolvedInputs: [],
        resolvedValues: { 'env.USER': "'dev'" },
        unresolvedVariables: [],
      })
    ).not.toThrow()
  })
})
