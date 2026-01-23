import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './app/createWindow';
import { registerIpcHandlers } from './ipc/registerIpc';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  // Register IPC handlers before creating windows
  registerIpcHandlers();

  mainWindow = createMainWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
