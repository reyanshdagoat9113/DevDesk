import { BrowserWindow } from 'electron';
import path from 'path';

// Dev server URL preference order:
// 1) VITE_DEV_SERVER_URL (can be set by scripts)
// 2) Default Vite URL
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);

export function createMainWindow(): BrowserWindow {
  // When compiled, this file lives in `dist/main/app/*`, so compute the dist/main root.
  const mainDistDir = path.join(__dirname, '..');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(mainDistDir, 'preload.js'),
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
    win.loadFile(path.join(mainDistDir, '../renderer/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
