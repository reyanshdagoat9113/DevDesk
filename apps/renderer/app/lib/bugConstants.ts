import type { BugSeverity } from '../types'

export const severityBadgeVariant: Record<
  BugSeverity,
  'secondary' | 'warning' | 'destructive'
> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
  critical: 'destructive',
}

export const severityLabels: Record<BugSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const VALID_SEVERITIES: readonly string[] = ['low', 'medium', 'high', 'critical']

export function isValidBugSeverity(value: string): value is BugSeverity {
  return VALID_SEVERITIES.includes(value)
}
