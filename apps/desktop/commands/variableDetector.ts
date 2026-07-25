import { variableResolver } from './variableResolver'
import type { CommandVariable } from '../data/model'

/**
 * Auto-detect variables from a command string
 */
export function detectVariables(command: string): CommandVariable[] {
  const variables = variableResolver.extractVariables(command)
  const commandVariables: CommandVariable[] = []
  const seen = new Set<string>()

  for (const variable of variables) {
    const cmdVar = parseVariableDefinition(variable)
    if (cmdVar && !isBuiltInVariable(variable)) {
      // Avoid duplicates
      if (!seen.has(cmdVar.name)) {
        seen.add(cmdVar.name)
        commandVariables.push(cmdVar)
      }
    }
  }

  return commandVariables
}

function isBuiltInVariable(variable: string): boolean {
  // These are auto-resolved, no user input needed
  return (
    variable.startsWith('project.') ||
    variable.startsWith('container.') ||
    variable.startsWith('env.')
  )
}

function parseVariableDefinition(variable: string): CommandVariable | null {
  // Handle {{input}} style variables
  if (variable.startsWith('input')) {
    const parts = variable.split(':')

    if (parts.length === 1) {
      return { name: 'input', required: true }
    }

    if (parts.length === 2) {
      // {{input:description}} - treat description as the variable name
      const description = parts[1]
      return { name: description, required: true, description }
    }

    // {{input:name:default}} - named input with default
    const name = parts[1]
    const defaultValue = parts[2]
    return {
      name,
      default: defaultValue,
      required: false,
      description: name,
    }
  }

  return null
}
