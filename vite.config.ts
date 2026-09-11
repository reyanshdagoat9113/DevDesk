import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { buildContentSecurityPolicy } from './apps/desktop/app/cspPolicy'

function getVendorChunkName(id: string) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const normalizedId = id.replace(/\\/g, '/')
  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react'
  }

  if (
    normalizedId.includes('/node_modules/@radix-ui/') ||
    normalizedId.includes('/node_modules/lucide-react/') ||
    normalizedId.includes('/node_modules/cmdk/') ||
    normalizedId.includes('/node_modules/fuse.js/') ||
    normalizedId.includes('/node_modules/class-variance-authority/') ||
    normalizedId.includes('/node_modules/clsx/') ||
    normalizedId.includes('/node_modules/tailwind-merge/')
  ) {
    return 'vendor-ui'
  }

  return 'vendor-misc'
}

function devCspPlugin() {
  return {
    name: 'devdesk-dev-csp',
    apply: 'serve' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/,
        `$1${buildContentSecurityPolicy(true)}$3`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), devCspPlugin()],
  root: 'apps/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/renderer'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
})
