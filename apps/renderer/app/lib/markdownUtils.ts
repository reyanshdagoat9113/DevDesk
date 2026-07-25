export interface CodeFenceMeta {
  language?: string
  runnable: boolean
}

export function parseCodeFenceMeta(className?: string): CodeFenceMeta {
  const languageClass = className
    ?.split(/\s+/)
    .find((entry) => entry.startsWith('language-'))

  if (!languageClass) {
    return { runnable: false }
  }

  const rawInfo = languageClass.replace(/^language-/, '').trim()
  if (!rawInfo) {
    return { runnable: false }
  }

  const runnable = rawInfo.endsWith(':run')
  const language = (runnable ? rawInfo.slice(0, -4) : rawInfo).trim()

  return {
    language: language || undefined,
    runnable,
  }
}

export interface TaskProgress {
  completed: number
  total: number
}

const taskLinePattern = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\]\s+)/

export function getTaskProgress(source: string): TaskProgress {
  return source.split(/\r?\n/).reduce<TaskProgress>(
    (progress, line) => {
      const match = line.match(taskLinePattern)

      if (!match) {
        return progress
      }

      return {
        completed: progress.completed + (match[2].toLowerCase() === 'x' ? 1 : 0),
        total: progress.total + 1,
      }
    },
    { completed: 0, total: 0 }
  )
}

export function toggleTaskAtIndex(source: string, taskIndex: number): string {
  if (taskIndex < 0) {
    return source
  }

  let currentTaskIndex = -1

  return source
    .split(/(\r?\n)/)
    .map((segment) => {
      if (segment === '\n' || segment === '\r\n') {
        return segment
      }

      const match = segment.match(taskLinePattern)
      if (!match) {
        return segment
      }

      currentTaskIndex += 1
      if (currentTaskIndex !== taskIndex) {
        return segment
      }

      const nextMarker = match[2].toLowerCase() === 'x' ? ' ' : 'x'
      return segment.replace(taskLinePattern, `$1${nextMarker}$3`)
    })
    .join('')
}
