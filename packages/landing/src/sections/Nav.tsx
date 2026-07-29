import { Github, Menu, Moon, Sun } from 'lucide-react'

import { Wordmark } from '@/components/Logo'
import {
  Button,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui'
import { GITHUB_URL, primaryDownload, siteMeta } from '@/config/site'
import { useTheme } from '@/hooks/useTheme'

const links = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#download', label: 'Download' },
  { href: siteMeta.docsUrl, label: 'Docs', external: true },
]

export function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 glass">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-foreground"
      >
        Skip to content
      </a>
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-6"
      >
        <a href="#top" className="focus-brand rounded-md" aria-label="DevDesk home">
          <Wordmark />
        </a>

        <ul className="ml-auto hidden items-center gap-0.5 lg:flex">
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

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
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

          {primaryDownload ? (
            <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
              <a href={primaryDownload.url}>Download</a>
            </Button>
          ) : (
            <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
              <a href="#download">Download</a>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(100%,20rem)] flex-col gap-6">
              <SheetHeader>
                <SheetTitle>
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile">
                <ul className="flex flex-col gap-1">
                  {links.map((link) => (
                    <li key={link.label}>
                      <SheetClose asChild>
                        <a
                          href={link.href}
                          {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                          className="focus-brand block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
                        >
                          {link.label}
                        </a>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </nav>
              <Separator />
              <SheetClose asChild>
                <Button asChild variant="brand" className="w-full">
                  <a href="#download">Get DevDesk</a>
                </Button>
              </SheetClose>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
