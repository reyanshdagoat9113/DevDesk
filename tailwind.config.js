/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './apps/renderer/index.html',
    './apps/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          subtle: 'hsl(var(--surface-subtle))',
          elevated: 'hsl(var(--surface-elevated))',
          border: 'hsl(var(--surface-border))',
        },
        code: {
          DEFAULT: 'hsl(var(--code-surface))',
          foreground: 'hsl(var(--code-foreground))',
          border: 'hsl(var(--code-border))',
        },
        terminal: {
          DEFAULT: 'hsl(var(--terminal-surface))',
          foreground: 'hsl(var(--terminal-foreground))',
          cursor: 'hsl(var(--terminal-cursor))',
          selection: 'hsl(var(--terminal-selection))',
        },
        status: {
          success: {
            DEFAULT: 'hsl(var(--status-success))',
            foreground: 'hsl(var(--status-success-foreground))',
          },
          warning: {
            DEFAULT: 'hsl(var(--status-warning))',
            foreground: 'hsl(var(--status-warning-foreground))',
          },
          error: {
            DEFAULT: 'hsl(var(--status-error))',
            foreground: 'hsl(var(--status-error-foreground))',
          },
          info: {
            DEFAULT: 'hsl(var(--status-info))',
            foreground: 'hsl(var(--status-info-foreground))',
          },
          inactive: {
            DEFAULT: 'hsl(var(--status-inactive))',
            foreground: 'hsl(var(--status-inactive-foreground))',
          },
        },
      },
      fontSize: {
        'ui-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.025em' }],
        'ui-section': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'ui-body': ['0.875rem', { lineHeight: '1.5rem' }],
        'ui-meta': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'ui-code': ['0.8125rem', { lineHeight: '1.25rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
