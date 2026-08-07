import { Container, CornerDownLeft, History, Pause, Play, PlayCircle, RotateCw, Square } from 'lucide-react'

import type { RunStatus } from '../types'

export function getStatusIcon(status: RunStatus) {
  switch (status) {
    case 'running':
      return <PlayCircle className="h-4 w-4 text-status-info" />
    case 'success':
      return <CornerDownLeft className="h-4 w-4 text-status-success" />
    case 'failed':
      return <CornerDownLeft className="h-4 w-4 text-status-error" />
    case 'stopped':
      return <Square className="h-4 w-4 text-status-warning" />
    default:
      return <History className="h-4 w-4" />
  }
}

export function getContainerActionIcon(action: string) {
  switch (action) {
    case 'start':
      return <Play className="h-4 w-4" />
    case 'stop':
      return <Square className="h-4 w-4" />
    case 'restart':
      return <RotateCw className="h-4 w-4" />
    case 'pause':
      return <Pause className="h-4 w-4" />
    case 'unpause':
      return <PlayCircle className="h-4 w-4" />
    default:
      return <Container className="h-4 w-4" />
  }
}
