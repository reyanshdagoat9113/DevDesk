import { Download, Github, Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { downloads, releasePublished, siteMeta, GITHUB_URL } from './config/site'
import { cn } from './lib/utils'

const THEME_KEY = 'devdesk-site-theme'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable: theme is session-only */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}

/**
 * Scaffold shell only. Page sections (hero, features, download cards, FAQ) land in
 * Phase 3 of docs/landing-page-plan.md; this verifies token parity, the site accent,
 * the theme toggle, and the download config wiring.
 */
export function App() {
  const { theme, toggle } = useTheme()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">{siteMeta.name}</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="focus-brand rounded-lg border border-border bg-card p-2 hover-glow"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <section className="flex flex-col gap-4 animate-slide-up">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-gradient">
          {siteMeta.name}
        </h1>
        <p className="text-pretty text-muted-foreground">{siteMeta.tagline}</p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {siteMeta.trustLine}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={releasePublished ? downloads[0].url : GITHUB_URL}
            className={cn(
              'focus-brand inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
              'bg-brand text-brand-foreground transition-opacity hover:opacity-90',
              !releasePublished && 'pointer-events-none opacity-50',
            )}
            aria-disabled={!releasePublished}
          >
            <Download className="size-4" />
            {releasePublished ? 'Download for Windows' : 'Download coming soon'}
          </a>
          <a
            href={GITHUB_URL}
            className="focus-brand inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover-glow"
          >
            <Github className="size-4" />
            View on GitHub
          </a>
        </div>
      </section>

      <section className="glass-card rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Planned artifacts</h2>
        <ul className="space-y-1 font-mono text-xs text-muted-foreground">
          {downloads.map((artifact) => (
            <li key={artifact.id}>{artifact.fileName}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
