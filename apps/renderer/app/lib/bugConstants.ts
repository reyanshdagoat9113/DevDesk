import type { BugSeverity, BugStatus } from '../types'

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

const VALID_SEVERITIES: readonly BugSeverity[] = ['low', 'medium', 'high', 'critical']

export function isValidBugSeverity(value: string): value is BugSeverity {
  return VALID_SEVERITIES.includes(value as BugSeverity)
}

export const statusBadgeVariant: Record<
  BugStatus,
  'secondary' | 'warning' | 'success' | 'outline'
> = {
  open: 'secondary',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'outline',
}

export const statusLabels: Record<BugStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const VALID_STATUSES: readonly BugStatus[] = ['open', 'in_progress', 'resolved', 'closed']

export function isValidBugStatus(value: string): value is BugStatus {
  return VALID_STATUSES.includes(value as BugStatus)
}
