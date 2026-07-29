import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'devdesk-site-theme'

export type Theme = 'light' | 'dark'

/**
 * Dark by default (index.html sets the class before first paint); the toggle persists the
 * choice so a reload keeps it.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
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
