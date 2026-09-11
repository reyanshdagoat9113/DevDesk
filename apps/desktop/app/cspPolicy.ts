const DEV_HMR_CONNECT_SRC = [
  'ws://localhost:5180',
  'ws://127.0.0.1:5180',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
].join(' ')

/**
 * Content-Security-Policy for the renderer.
 * Production omits script unsafe-eval/unsafe-inline and localhost HMR origins.
 * Dev keeps those so Vite HMR / React Refresh can run.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'"
  const connectSrc = isDev
    ? `connect-src 'self' ${DEV_HMR_CONNECT_SRC}`
    : "connect-src 'self'"

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    connectSrc,
    "worker-src 'self' blob:",
  ].join('; ')
}
