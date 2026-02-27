import type { Project, Container, CommandVariable } from '../data/model'

export interface VariableContext {
  project: Project
  containers: Container[]
  env: NodeJS.ProcessEnv
}

export interface VariableResolutionResult {
  /** Command with all possible variables resolved */
  resolvedCommand: string
  /** Variables that require user input */
  unresolvedInputs: CommandVariable[]
  /** Record of resolved values for history */
  resolvedValues: Record<string, string>
}

interface ResolvedVariable {
  type: 'resolved'
  value: string
}

interface InputRequiredVariable {
  type: 'input-required'
  name: string
  default?: string
  required: boolean
  description?: string
}

interface UnresolvedVariable {
  type: 'unresolved'
}

type VariableResolution = ResolvedVariable | InputRequiredVariable | UnresolvedVariable

export class VariableResolver {
  private static readonly VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?(?::[^}]*)?)\s*\}\}/g

  /**
   * Extract all variable names from a command template
   */
  extractVariables(command: string): string[] {
    const variables = new Set<string>()
    const matches = command.matchAll(VariableResolver.VARIABLE_PATTERN)
    for (const match of matches) {
      variables.add(match[1].trim())
    }
    return [...variables]
  }

  /**
   * Resolve variables in a command template
   */
  resolve(
    command: string,
    context: VariableContext,
    userInputs?: Record<string, string>
  ): VariableResolutionResult {
    const resolvedValues: Record<string, string> = {}
    const unresolvedInputs: CommandVariable[] = []

    const resolvedCommand = command.replace(
      VariableResolver.VARIABLE_PATTERN,
      (match, varPath: string) => {
        const trimmed = varPath.trim()
        const resolved = this.resolveVariable(trimmed, context, userInputs)

        if (resolved.type === 'resolved') {
          resolvedValues[trimmed] = resolved.value
          // Return without quotes since escapeShellValue already adds them
          return resolved.value
        }

        if (resolved.type === 'input-required') {
          // Check if we already have this input in unresolvedInputs
          const existing = unresolvedInputs.find((i) => i.name === resolved.name)
          if (!existing) {
            unresolvedInputs.push({
              name: resolved.name,
              default: resolved.default,
              required: resolved.required,
              description: resolved.description,
            })
          }
        }

        // Keep original placeholder if not resolved
        return match
      }
    )

    return { resolvedCommand, unresolvedInputs, resolvedValues }
  }

  private resolveVariable(
    varPath: string,
    context: VariableContext,
    userInputs?: Record<string, string>
  ): VariableResolution {
    // Handle {{input}} and {{input:prompt}} and {{input:name:default}}
    if (varPath.startsWith('input')) {
      return this.resolveInputVariable(varPath, userInputs)
    }

    // Handle {{env.VAR_NAME}}
    if (varPath.startsWith('env.')) {
      const envName = varPath.slice(4)
      const envValue = context.env[envName]
      if (envValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(envValue) }
      }
      return { type: 'unresolved' }
    }

    // Handle {{project.*}}
    if (varPath.startsWith('project.')) {
      const projectValue = this.resolveProjectVariable(varPath, context.project)
      if (projectValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(projectValue) }
      }
      return { type: 'unresolved' }
    }

    // Handle {{container.*}}
    if (varPath.startsWith('container.')) {
      const containerValue = this.resolveContainerVariable(varPath, context.containers)
      if (containerValue !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(containerValue) }
      }
      return { type: 'unresolved' }
    }

    return { type: 'unresolved' }
  }

  private resolveInputVariable(
    varPath: string,
    userInputs?: Record<string, string>
  ): VariableResolution {
    // Parse {{input}}, {{input:prompt}}, {{input:name:default}}
    const parts = varPath.split(':')

    if (parts.length === 1) {
      // {{input}} - simple prompt
      if (userInputs?.input !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(userInputs.input) }
      }
      return {
        type: 'input-required',
        name: 'input',
        required: true,
        description: 'Input required',
      }
    }

    if (parts.length === 2) {
      // {{input:prompt}} - prompt with description
      const description = parts[1]
      if (userInputs?.[description] !== undefined) {
        return { type: 'resolved', value: this.escapeShellValue(userInputs[description]) }
      }

      return {
        type: 'input-required',
        name: description,
        required: true,
        description: description,
      }
    }

    // {{input:name:default}} - named input with default
    const name = parts[1]
    const defaultValue = parts[2]

    if (userInputs?.[name] !== undefined) {
      return { type: 'resolved', value: this.escapeShellValue(userInputs[name]) }
    }

    return {
      type: 'input-required',
      name,
      required: false,
      default: defaultValue,
      description: name,
    }
  }

  private resolveProjectVariable(varPath: string, project: Project): string | undefined {
    const field = varPath.slice(8) // Remove 'project.'
    switch (field) {
      case 'name':
        return project.name
      case 'path':
        return project.path
      case 'type':
        return project.type
      default:
        return undefined
    }
  }

  private resolveContainerVariable(
    varPath: string,
    containers: Container[]
  ): string | undefined {
    const field = varPath.slice(10) // Remove 'container.'

    if (field === 'name') {
      return containers[0]?.name
    }

    if (field === 'names') {
      return containers.map((c) => c.name).join(' ')
    }

    return undefined
  }

  /**
   * Escape a value for safe shell usage
   */
  private escapeShellValue(value: string): string {
    // Use single quotes and escape any single quotes in the value
    if (!value.includes("'")) {
      return `'${value}'`
    }
    // Handle values with single quotes by ending quote, adding escaped quote, restarting quote
    return `'${value.replace(/'/g, "'\\''")}'`
  }
}

export const variableResolver = new VariableResolver()
