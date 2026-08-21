import { useEffect, useState } from 'react'

import { vaultCommands } from '@/config/content'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

export function BlockCursor({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('cursor-block', className)} />
}

/**
 * The page's signature: a command-vault prompt with the logo's block cursor.
 * Types through real commands a user would save; holds still when motion is reduced.
 */
export function VaultPrompt({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const [commandIndex, setCommandIndex] = useState(0)
  const [charCount, setCharCount] = useState(vaultCommands[0].length)
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('holding')

  useEffect(() => {
    if (reduced) {
      setCharCount(vaultCommands[0].length)
      setCommandIndex(0)
      return
    }

    const command = vaultCommands[commandIndex]

    if (phase === 'typing') {
      if (charCount >= command.length) {
        const hold = window.setTimeout(() => setPhase('holding'), 1700)
        return () => window.clearTimeout(hold)
      }
      const step = window.setTimeout(() => setCharCount((n) => n + 1), 32 + Math.random() * 48)
      return () => window.clearTimeout(step)
    }

    if (phase === 'holding') {
      const hold = window.setTimeout(() => setPhase('deleting'), 2200)
      return () => window.clearTimeout(hold)
    }

    if (charCount <= 0) {
      setCommandIndex((i) => (i + 1) % vaultCommands.length)
      setPhase('typing')
      return
    }
    const step = window.setTimeout(() => setCharCount((n) => n - 1), 18)
    return () => window.clearTimeout(step)
  }, [charCount, phase, commandIndex, reduced])

  const command = vaultCommands[commandIndex]
  const shown = reduced ? vaultCommands[0] : command.slice(0, charCount)

  return (
    <div
      className={cn(
        'rounded-lg border border-border/70 bg-card/70 px-4 py-3 shadow-sm',
        className,
      )}
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        command vault
      </p>
      <p className="flex min-h-[1.5rem] items-center gap-2 font-mono text-sm sm:text-[0.95rem]">
        <span className="select-none text-muted-foreground" aria-hidden="true">
          $
        </span>
        <span className="min-w-0">
          <span className="text-foreground">{shown}</span>
          <BlockCursor />
        </span>
        <span className="sr-only">Example saved command: {vaultCommands[0]}</span>
      </p>
    </div>
  )
}

export function SectionPath({ segment }: { segment: string }) {
  return (
    <p className="mb-4 font-mono text-xs text-muted-foreground">
      <span className="text-foreground/75">~/devdesk</span>
      <span className="mx-1.5 text-foreground/30">&gt;</span>
      {segment}
    </p>
  )
}
