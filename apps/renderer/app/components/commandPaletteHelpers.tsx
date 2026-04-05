import { Container, CornerDownLeft, History, Pause, Play, PlayCircle, RotateCw, Square } from 'lucide-react'

import type { RunStatus } from '../types'

export function getStatusIcon(status: RunStatus) {
  switch (status) {
    case 'running':
      return <PlayCircle className="h-4 w-4 text-blue-500" />
    case 'success':
      return <CornerDownLeft className="h-4 w-4 text-green-500" />
    case 'failed':
      return <CornerDownLeft className="h-4 w-4 text-red-500" />
    case 'stopped':
      return <Square className="h-4 w-4 text-yellow-500" />
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
