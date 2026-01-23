import { BrowserWindow } from 'electron';
import path from 'path';

// Dev server URL preference order:
// 1) VITE_DEV_SERVER_URL (can be set by scripts)
// 2) Default Vite URL
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // In production, `preload.js` is emitted next to the bundled main entry (`dist/main/preload.js`).
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // Renderer build outputs to `dist/` and is loaded from disk in production.
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
