/**
 * Landing-page screenshot generator.
 *
 * Renders the real DevDesk renderer bundle in a frameless 1600x1000 Electron window,
 * backed by the stubbed electronAPI in preload.cjs, and writes one PNG per view to
 * packages/landing/public/screenshots/.
 *
 * Because every shot is a genuine render of the shipped components, elements cannot
 * overlap or be clipped the way a hand-composited image can.
 *
 * Interactions use webContents.sendInputEvent rather than element.click(): the sidebar
 * is a Radix Tabs group with automatic activation, which responds to real pointer and
 * focus events but ignores a synthetic click() dispatched from script.
 *
 * Usage:
 *   npm run landing:shots            # all views
 *   npm run landing:shots -- engine  # one or more view ids
 */
const path = require('node:path')
const fs = require('node:fs')
const { app, BrowserWindow } = require('electron')

const WIDTH = 1600
const HEIGHT = 1000

// Force 1x rendering so capturePage() returns exactly WIDTH x HEIGHT on HiDPI displays.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('high-dpi-support', '1')

// One window is created and destroyed per shot; without this the app would quit as
// soon as the first window closes and only the first screenshot would be written.
app.on('window-all-closed', () => {})

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
const rendererIndex = path.join(repoRoot, 'dist', 'renderer', 'index.html')
const outDir = path.join(repoRoot, 'packages', 'landing', 'public', 'screenshots')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Finder for a left-hand nav item, scoped to the sidebar so project tabs never match. */
const nav = (label) =>
  `[...document.querySelectorAll('aside [role="tab"]')]` +
  `.find((el) => el.textContent.trim().startsWith(${JSON.stringify(label)}))`

/**
 * Finder for a clickable element inside the main pane. Cards concatenate icon + name +
 * path, so an exact match is tried first and a substring match is the fallback.
 */
const inMain = (text, selector = 'button, [role="tab"], [role="option"], li') =>
  `(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(`main ${selector}`)})];
    const needle = ${JSON.stringify(text)};
    return els.find((el) => el.textContent.trim() === needle)
      || els.find((el) => el.textContent.trim().startsWith(needle))
      || els.find((el) => el.textContent.includes(needle));
  })()`

/** Reject rather than hang if the renderer stops answering. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${label}`)), ms),
    ),
  ])
}

/** Resolve a finder to viewport coordinates, scrolling it into view first. */
async function locate(win, finder) {
  return withTimeout(
    win.webContents.executeJavaScript(`(() => {
    const target = ${finder};
    if (!target) {
      const seen = [...document.querySelectorAll('aside [role="tab"], main button, main [role="tab"]')]
        .slice(0, 30).map((el) => el.textContent.trim()).join(' | ');
      return { ok: false, seen };
    }
    const r = target.getBoundingClientRect();
    return {
      ok: r.width > 0 && r.height > 0,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    };
  })()`),
    8000,
    'locate',
  )
}

/** Real pointer click: move, focus-equivalent down, then up. */
async function click(win, finder) {
  let hit
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      hit = await locate(win, finder)
      break
    } catch (error) {
      if (attempt === 1) throw error
      await sleep(600)
    }
  }
  if (!hit || !hit.ok) {
    return `miss (${hit && hit.seen ? hit.seen.slice(0, 220) : 'no element'})`
  }
  const at = { x: hit.x, y: hit.y }
  win.webContents.sendInputEvent({ type: 'mouseMove', ...at })
  await sleep(40)
  win.webContents.sendInputEvent({ type: 'mouseDown', ...at, button: 'left', clickCount: 1 })
  await sleep(40)
  win.webContents.sendInputEvent({ type: 'mouseUp', ...at, button: 'left', clickCount: 1 })
  return 'ok'
}

const shots = [
  // DevDesk is projects[0] and is selected on boot, so no card click is needed.
  {
    id: 'projects',
    steps: [{ find: nav('Projects'), wait: 900 }],
  },
  {
    id: 'commands',
    steps: [
      { find: nav('Commands'), wait: 800 },
      { find: inMain('Run tests matching a pattern'), wait: 700 },
    ],
  },
  {
    id: 'engine',
    steps: [{ find: nav('Engine'), wait: 1200 }],
  },
  // postgres sorts first among running containers and is selected on arrival.
  {
    id: 'containers',
    steps: [{ find: nav('Containers'), wait: 1400 }],
  },
  {
    id: 'history',
    steps: [
      { find: nav('History'), wait: 800 },
      { find: inMain('Build production bundle'), wait: 900 },
    ],
  },
  // The Terminal view opens on an empty state, so a session has to be created before
  // there is anything worth capturing.
  {
    id: 'terminal',
    steps: [
      { label: 'nav Terminal', find: nav('Terminal'), wait: 900 },
      { label: 'New Terminal', find: inMain('New Terminal'), wait: 2200 },
    ],
  },
]

async function capture(win, id) {
  const image = await win.webContents.capturePage()
  const size = image.getSize()
  let out = image
  if (size.width !== WIDTH || size.height !== HEIGHT) {
    console.warn(`[shots] ${id}: captured ${size.width}x${size.height}, resizing`)
    out = image.resize({ width: WIDTH, height: HEIGHT, quality: 'best' })
  }
  const file = path.join(outDir, `${id}.png`)
  fs.writeFileSync(file, out.toPNG())
  console.log(`[shots] wrote ${path.relative(repoRoot, file)} (${out.getSize().width}x${out.getSize().height})`)
}

async function run() {
  if (!fs.existsSync(rendererIndex)) {
    throw new Error(`Renderer bundle missing at ${rendererIndex}. Run "npm run build:renderer" first.`)
  }
  fs.mkdirSync(outDir, { recursive: true })

  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
  const selected = requested.length ? shots.filter((s) => requested.includes(s.id)) : shots
  if (!selected.length) {
    throw new Error(`No matching views. Known ids: ${shots.map((s) => s.id).join(', ')}`)
  }

  let failures = 0
  for (const shot of selected) {
    console.log(`[shots] ${shot.id}`)

    // A dedicated window per shot. Views left mounted by an earlier shot keep polling
    // and subscribing, which pegs the renderer and stalls executeJavaScript, so reuse
    // is not safe here. A fresh window also gives capturePage a clean compositor.
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      useContentSize: true,
      frame: false,
      show: true,
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
        zoomFactor: 1,
        devTools: false,
      },
    })

    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2 && !message.includes('Electron Security Warning')) {
        console.log(`[renderer] ${message}`)
      }
    })

    try {
      await withTimeout(win.loadFile(rendererIndex), 30_000, 'loadFile')
      win.focus()
      // Let bootstrap settle: 10 parallel IPC calls plus the first paint.
      await sleep(1900)

      // Force dark theme so every shot is consistent regardless of persisted state.
      await withTimeout(
        win.webContents.executeJavaScript(`(() => {
          localStorage.setItem('devdesk-theme', 'dark');
          document.documentElement.classList.add('dark');
          return document.documentElement.className;
        })()`),
        8000,
        'theme',
      )
      await sleep(350)

      for (const [index, step] of shot.steps.entries()) {
        const label = step.label ?? `step ${index + 1}`
        const result = await click(win, step.find)
        if (result !== 'ok') {
          failures += 1
          console.warn(`[shots]   ${label} -> ${result}`)
        } else {
          console.log(`[shots]   ${label} ok`)
        }
        await sleep(step.wait ?? 400)
      }

      // Park the cursor away from content so no hover state is baked in.
      win.webContents.sendInputEvent({ type: 'mouseMove', x: WIDTH - 3, y: HEIGHT - 3 })
      await sleep(300)
      await capture(win, shot.id)
    } catch (error) {
      failures += 1
      console.warn(`[shots]   ${shot.id} -> ${error.message ?? error}`)
    } finally {
      if (!win.isDestroyed()) win.destroy()
      await sleep(200)
    }
  }

  if (failures) {
    throw new Error(`${failures} step(s) failed; check the warnings above`)
  }
}

app.whenReady().then(async () => {
  try {
    await run()
    app.exit(0)
  } catch (error) {
    console.error('[shots] failed:', error.message ?? error)
    app.exit(1)
  }
})
