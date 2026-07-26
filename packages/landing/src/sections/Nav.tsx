import { Github, Moon, Sun } from 'lucide-react'

import { Wordmark } from '@/components/Logo'
import { Button } from '@/components/ui'
import { GITHUB_URL, siteMeta } from '@/config/site'
import { useTheme } from '@/hooks/useTheme'

const links = [
  { href: '#features', label: 'Features' },
  { href: '#download', label: 'Download' },
  { href: siteMeta.docsUrl, label: 'Docs', external: true },
]

export function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6"
      >
        <a href="#top" className="focus-brand rounded-md" aria-label="DevDesk home">
          <Wordmark />
        </a>

        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="focus-brand rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="icon" aria-label="DevDesk on GitHub">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="size-4" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </nav>
    </header>
  )
}
